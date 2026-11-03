import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { FeatureFlag } from '@medusajs/framework/utils'
import { GET } from '../../src/api/store/manual-payments/orders/[id]/route'
import { defaultSettings } from '../../src/lib/settings'
import { createRequest, createResponse, QUERY_KEY } from './support/routes'

const PID = 'pp_manual_bank'
// Translations of the settings row per locale; the fake translation module filters like the real one.
const translated: Record<string, string> = { sl: 'Plačajte', en: 'Pay now' }
const reg = (orders: unknown[], settings: Record<string, unknown> = {}) => {
  const rows: Record<string, unknown>[] = []
  return {
    translation: {
      listTranslations: async (f: { reference: string; reference_id: string; locale_code: string }) =>
        f.reference === 'manual_payment_provider_setting' && f.reference_id === 'mpps_1' && translated[f.locale_code]
          ? [{ translations: { instructions: translated[f.locale_code], label: `Label ${f.locale_code}` } }]
          : [],
    },
    configModule: {
      modules: {
        payment: {
          options: {
            providers: [
              {
                resolve: '@rokmohar/medusa-payment-manual/providers/manual',
                id: 'bank',
                options: { type: 'bank_transfer' },
              },
            ],
          },
        },
      },
    },
    [QUERY_KEY]: { graph: async () => ({ data: orders }) },
    manual_payment: {
      getSettings: async () => ({
        ...defaultSettings(PID),
        id: 'mpps_1',
        label: 'Base Label',
        instructions: 'Base',
        ...settings,
      }),
      listManualPaymentOrders: async () => rows,
      createManualPaymentOrders: async (d: Record<string, unknown>) => {
        rows.push({ id: 'm1', ...d })
        return rows[0]
      },
    },
  }
}

test('404 when order missing', async () => {
  const { res } = createResponse()
  await assert.rejects(
    GET(createRequest({ params: { id: 'x' }, query: {} } as never, reg([])), res as never),
    (e: any) => e.type === 'not_found',
  )
})

afterEach(() => {
  FeatureFlag.setFlag('translation', false)
})

const order = (locale: string | null) => ({
  id: 'o1',
  display_id: 1,
  currency_code: 'eur',
  locale,
  shipping_address: null,
  payment_collections: [{ payments: [{ id: 'p', provider_id: PID, amount: 5 }] }],
})
const instructions = async (o: unknown, request: Record<string, unknown>) => {
  const { res, payloads } = createResponse<any>()
  await GET(createRequest({ params: { id: 'o1' }, query: {}, ...request } as never, reg([o])), res as never)
  return payloads[0].payment
}

test('instructions are translated for the order locale, before the request locale', async () => {
  FeatureFlag.setFlag('translation', true)
  const payment = await instructions(order('sl'), { locale: 'en' })
  assert.equal(payment.instructions, 'Plačajte')
  assert.equal(payment.amount, 5)
})

test('without an order locale, the request locale (req.locale, else ?locale=) is used', async () => {
  FeatureFlag.setFlag('translation', true)
  assert.equal((await instructions(order(null), { locale: 'en' })).instructions, 'Pay now')
  assert.equal((await instructions(order(null), { query: { locale: 'sl' } })).instructions, 'Plačajte')
})

test('base instructions without a translation, a locale, or the translation feature', async () => {
  FeatureFlag.setFlag('translation', true)
  assert.equal((await instructions(order('de'), {})).instructions, 'Base')
  assert.equal((await instructions(order(null), {})).instructions, 'Base')
  FeatureFlag.setFlag('translation', false)
  assert.equal((await instructions(order('sl'), {})).instructions, 'Base')
})

test('type comes from the payment data, else from the provider config', async () => {
  const order = (data: unknown) => ({
    id: 'o1',
    display_id: 1,
    currency_code: 'eur',
    shipping_address: null,
    payment_collections: [{ payments: [{ id: 'p', provider_id: PID, amount: 5, data }] }],
  })
  const run = async (data: unknown) => {
    const { res, payloads } = createResponse<any>()
    await GET(createRequest({ params: { id: 'o1' }, query: {} } as never, reg([order(data)])), res as never)
    return payloads[0].payment.type
  }

  assert.equal(await run({ type: 'invoice' }), 'invoice')
  assert.equal(await run({}), 'bank_transfer')
  assert.equal(await run(null), 'bank_transfer')
  assert.equal(await run({ type: 'bogus' }), 'bank_transfer')
})

test('label is translated for the order locale, else the stored label, null when unset', async () => {
  FeatureFlag.setFlag('translation', true)
  assert.equal((await instructions(order('sl'), { locale: 'en' })).label, 'Label sl')
  assert.equal((await instructions(order(null), {})).label, 'Base Label')
  FeatureFlag.setFlag('translation', false)
  assert.equal((await instructions(order('sl'), {})).label, 'Base Label')
})
