import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildOrderPaymentResponse, ensureOrderPayment, type OrderForPayment } from '../../src/lib/order-payment'
import { defaultSettings } from '../../src/lib/settings'
import type { BankAccount, ProviderSettings } from '../../src/lib/types'

const acc = (id: string, countries: string[] = []): BankAccount => ({
  id,
  recipient: 'Acme d.o.o.',
  address_1: 'Main 1',
  postal_code: '1000',
  city: 'Ljubljana',
  country_code: 'si',
  iban: 'SI56263300012039086',
  bic: null,
  bank_name: null,
  countries,
})

const PID = 'pp_manual_bank'
const order = (provider_id = PID, extra: Partial<OrderForPayment> = {}): OrderForPayment => ({
  id: 'order_1',
  display_id: 7,
  currency_code: 'eur',
  shipping_address: {
    first_name: 'Ana',
    last_name: 'Novak',
    address_1: 'Dolga 2',
    address_2: 'apt 3',
    postal_code: '2000',
    city: 'Maribor',
    country_code: 'SI',
  },
  payment_collections: [{ payments: [{ id: 'pay_1', provider_id, amount: '12.5' as never }] }],
  ...extra,
})

const settings = (over: Partial<ProviderSettings> = {}): ProviderSettings => ({
  ...defaultSettings(PID),
  bank_accounts: [acc('def'), acc('si', ['si'])],
  reference_template: '{display_id}',
  reference_scheme: 'SI12',
  instructions: 'Pay now',
  ...over,
})

const makeContainer = (o: OrderForPayment | null, store: { s: ProviderSettings | null }) => {
  const rows: Record<string, unknown>[] = []
  const svc = {
    rows,
    getSettings: async () => store.s,
    listManualPaymentOrders: async (f: { order_id: string }) => rows.filter((r) => r.order_id === f.order_id),
    createManualPaymentOrders: async (d: Record<string, unknown>) => {
      const r = { id: `mpo_${rows.length}`, ...d }
      rows.push(r)
      return r
    },
  }
  const container = {
    resolve: (k: string) => (k === 'query' ? { graph: async () => ({ data: o ? [o] : [] }) } : svc),
  }
  return { container: container as never, svc }
}

test('non-manual order: no row, null payment', async () => {
  const { container, svc } = makeContainer(order('pp_system_default'), { s: settings() })
  assert.equal(await ensureOrderPayment(container, 'order_1'), null)
  assert.equal(svc.rows.length, 0)
  assert.equal(buildOrderPaymentResponse(order('pp_system_default'), settings(), null), null)
})

test('manual provider without settings: null', async () => {
  const { container, svc } = makeContainer(order(), { s: null })
  assert.equal(await ensureOrderPayment(container, 'order_1'), null)
  assert.equal(svc.rows.length, 0)
})

test('idempotent; the reference stays the same after the template changes', async () => {
  const store = { s: settings() as ProviderSettings | null }
  const { container, svc } = makeContainer(order(), store)
  const a = await ensureOrderPayment(container, 'order_1')
  assert.equal(a?.reference, 'SI12 78')
  assert.equal('bank_accounts' in (svc.rows[0] ?? {}), false)
  store.s = settings({ reference_template: '99{display_id}', reference_scheme: 'RF' })
  const b = await ensureOrderPayment(container, 'order_1')
  assert.equal(svc.rows.length, 1)
  assert.equal(b?.reference, 'SI12 78')
  assert.equal(buildOrderPaymentResponse(order(), store.s, b, 'bank_transfer')?.reference, 'SI12 78')
})

test('bank accounts come from the current settings, not from placement', async () => {
  const store = { s: settings() as ProviderSettings | null }
  const { container } = makeContainer(order(), store)
  const snap = await ensureOrderPayment(container, 'order_1')
  const shown = () => {
    return buildOrderPaymentResponse(order(), store.s, snap, 'bank_transfer')?.bank_accounts.map((b) => {
      return [b.id, b.iban]
    })
  }

  assert.deepEqual(shown(), [['si', 'SI56263300012039086']])
  // Edited after placement.
  store.s = settings({ bank_accounts: [acc('def'), { ...acc('si', ['si']), iban: 'SI56020360253863406' }] })
  assert.deepEqual(shown(), [['si', 'SI56020360253863406']])
  // Added after placement, in display order.
  store.s = settings({ bank_accounts: [acc('def'), acc('si2', ['si']), acc('si', ['si'])] })
  assert.deepEqual(shown(), [
    ['si2', 'SI56263300012039086'],
    ['si', 'SI56263300012039086'],
  ])
  // Deleted: the country's account disappears and the default takes over.
  store.s = settings({ bank_accounts: [acc('def'), acc('hr', ['hr'])] })
  assert.deepEqual(shown(), [['def', 'SI56263300012039086']])
})

test("bank accounts match the order's shipping country, else the default account", () => {
  const snap = { id: 'x', order_id: 'order_1', provider_id: PID, reference: null }
  const s = settings({ bank_accounts: [acc('def'), acc('si', ['si']), acc('hr', ['hr'])] })
  const ids = (country_code: string | null) => {
    const o = order(PID, { shipping_address: { ...order().shipping_address, country_code } })

    return buildOrderPaymentResponse(o, s, snap, 'bank_transfer')?.bank_accounts.map((b) => {
      return b.id
    })
  }

  assert.deepEqual(ids('HR'), ['hr'])
  assert.deepEqual(ids('de'), ['def'])
  assert.deepEqual(ids(null), ['def'])
})

test('race on create re-reads existing row', async () => {
  const { container, svc } = makeContainer(order(), { s: settings() })
  svc.createManualPaymentOrders = async (d) => {
    svc.rows.push({ id: 'winner', ...d })
    throw new Error('unique')
  }
  const r = await ensureOrderPayment(container, 'order_1')
  assert.equal(r?.id, 'winner')
})

test("instructions are the given settings' instructions (already translated by the caller)", () => {
  const snap = { id: 'x', order_id: 'order_1', provider_id: PID, reference: null }
  const get = (s: ProviderSettings) => buildOrderPaymentResponse(order(), s, snap)?.instructions
  assert.equal(get(settings()), 'Pay now')
  assert.equal(get(settings({ instructions: null })), null)
})

test('cash on delivery hides bank accounts, reference and QR, like the admin', () => {
  const snap = {
    id: 'x',
    order_id: 'order_1',
    provider_id: PID,
    reference: 'SI00 7',
  }
  const s = settings({ qr_type: 'upn', instructions: 'Plačilo ob prevzemu' })
  const cod = buildOrderPaymentResponse(order(), s, snap, 'cash_on_delivery')
  assert.equal(cod?.type, 'cash_on_delivery')
  assert.equal(cod?.instructions, 'Plačilo ob prevzemu')
  assert.equal(cod?.reference, null)
  assert.equal(cod?.qr_type, 'none')
  assert.deepEqual(cod?.bank_accounts, [])
  const bank = buildOrderPaymentResponse(order(), s, snap, 'bank_transfer')
  assert.equal(bank?.reference, 'SI00 7')
  assert.equal(bank?.bank_accounts.length, 1)
})

test('label is the given settings label (already translated by the caller), null when unset', () => {
  const snap = { id: 'x', order_id: 'order_1', provider_id: PID, reference: null }
  const get = (s: ProviderSettings) => buildOrderPaymentResponse(order(), s, snap)?.label

  assert.equal(get(settings({ label: 'Bančno nakazilo' })), 'Bančno nakazilo')
  assert.equal(get(settings({ label: null })), null)
})

test('bank accounts are returned with the recipient address, without countries', () => {
  const snap = {
    id: 'x',
    order_id: 'order_1',
    provider_id: PID,
    reference: 'SI12 7',
  }
  const res = buildOrderPaymentResponse(order(), settings({ qr_type: 'upn' }), snap, 'bank_transfer')
  const { qr, ...account } = res!.bank_accounts[0]

  assert.deepEqual(account, {
    id: 'si',
    recipient: 'Acme d.o.o.',
    address_1: 'Main 1',
    postal_code: '1000',
    city: 'Ljubljana',
    country_code: 'si',
    iban: 'SI56263300012039086',
    bic: null,
    bank_name: null,
  })
  assert.deepEqual(qr?.split('\n').slice(17, 19), ['Main 1', '1000 Ljubljana'])
})
