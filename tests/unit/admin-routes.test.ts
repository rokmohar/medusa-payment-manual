import assert from 'node:assert/strict'
import { test } from 'node:test'
import { GET as list } from '../../src/api/admin/manual-payments/route'
import { GET as getOne, POST as save } from '../../src/api/admin/manual-payments/[provider_id]/route'
import { POST as impact } from '../../src/api/admin/manual-payments/[provider_id]/impact/route'
import { POST as rank } from '../../src/api/admin/manual-payments/rank/route'
import { assertValidSettings } from '../../src/modules/manual-payment/mappers'
import { defaultSettings } from '../../src/lib/settings'
import { createRequest, createResponse, QUERY_KEY } from './support/routes'

const stored = new Map<string, any>()
const payment = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  provider_id: 'pp_manual_cod',
  captures: [],
  refunds: [],
  payment_collection: {
    order: {
      id: `o_${id}`,
      created_at: new Date(),
      status: 'pending',
      payment_collections: [],
      fulfillments: [{ delivered_at: new Date(), canceled_at: null }],
    },
  },
  ...over,
})
const PATH = '@rokmohar/medusa-payment-manual/providers/manual'
const reg = (payments: unknown[] = []) => ({
  configModule: {
    modules: {
      payment: {
        options: {
          providers: [
            { resolve: PATH, id: 'cod', options: { type: 'cash_on_delivery' } },
            { resolve: PATH, id: 'bank' },
          ],
        },
      },
    },
  },
  payment: {
    listPaymentProviders: async () => [
      { id: 'pp_manual_cod', is_enabled: true },
      { id: 'pp_manual_bank', is_enabled: false },
      { id: 'pp_stripe_stripe', is_enabled: true },
    ],
  },
  [QUERY_KEY]: { graph: async () => ({ data: payments }) },
  manual_payment: {
    listSettings: async () => [...stored.values()],
    getSettings: async (id: string) => stored.get(id) ?? null,
    upsertSettings: async (s: any) => {
      const v = assertValidSettings(s)
      stored.set(v.provider_id, v)
      return v
    },
    setRanks: async (ids: string[]) => {
      ids.forEach((id, i) => stored.set(id, { ...(stored.get(id) ?? defaultSettings(id)), rank: i }))
    },
  },
})
const req = (provider_id: string, body?: unknown, payments?: unknown[]) =>
  createRequest({ params: { provider_id }, body } as never, reg(payments))

test('list returns manual providers (equal ranks: by provider_id), settings null when none stored', async () => {
  stored.clear()
  const { res, payloads } = createResponse<any>()
  await list(createRequest({} as never, reg()), res as never)
  assert.deepEqual(payloads[0], {
    providers: [
      { provider_id: 'pp_manual_bank', is_enabled: false, type: 'other', settings: null },
      { provider_id: 'pp_manual_cod', is_enabled: true, type: 'cash_on_delivery', settings: null },
    ],
  })
})

test('404 for a non-manual provider on GET/POST/impact', async () => {
  const { res } = createResponse()
  for (const fn of [getOne, save, impact]) {
    await assert.rejects(fn(req('pp_stripe_stripe', {}) as never, res as never), (e: any) => e.type === 'not_found')
  }
})

test('GET returns defaults when nothing stored', async () => {
  stored.clear()
  const { res, payloads } = createResponse<any>()
  await getOne(req('pp_manual_cod') as never, res as never)
  assert.deepEqual(payloads[0], { type: 'cash_on_delivery', settings: defaultSettings('pp_manual_cod') })
})

const body = () => {
  const { provider_id: _, ...rest } = defaultSettings('pp_manual_cod')
  return rest
}

test('POST invalid -> 400 with errors; negative fee -> 400', async () => {
  stored.clear()
  const { res } = createResponse()
  await assert.rejects(
    save(req('pp_manual_cod', { ...body(), auto_cancel_enabled: true }) as never, res as never),
    (e: any) => e.type === 'invalid_data' && /Auto-cancel/.test(e.message),
  )
  await assert.rejects(
    save(req('pp_manual_cod', { ...body(), fee: { eur: -1 } }) as never, res as never),
    (e: any) => e.type === 'invalid_data' && /fee/.test(e.message),
  )
  assert.equal(stored.size, 0)
})

test('upsertSettings rejects a negative amount and stores nothing', () => {
  stored.clear()
  assert.throws(
    () => assertValidSettings({ ...defaultSettings('pp_manual_cod'), fee: { eur: -1 } }),
    (e: any) => e.type === 'invalid_data',
  )
})

test('GET returns type other for a provider without one', async () => {
  stored.clear()
  const { res, payloads } = createResponse<any>()
  await getOne(req('pp_manual_bank') as never, res as never)
  assert.equal(payloads[0].type, 'other')
})

test('POST valid persists and returns', async () => {
  stored.clear()
  const { res, payloads } = createResponse<any>()
  await save(req('pp_manual_cod', { ...body(), capture_mode: 'on_order', fee: { EUR: 2 } }) as never, res as never)
  assert.equal(payloads[0].settings.capture_mode, 'on_order')
  assert.deepEqual(stored.get('pp_manual_cod').fee, { eur: 2 })
})

test('impact: on_delivery counts delivered uncaptured; cancel 0 when off', async () => {
  stored.clear()
  const { res, payloads } = createResponse<any>()
  const undelivered = payment('p2', {
    payment_collection: { order: { ...payment('x').payment_collection.order, id: 'o2', fulfillments: [] } },
  })
  await impact(
    req('pp_manual_cod', { capture_mode: 'on_delivery', auto_cancel_enabled: false, auto_cancel_days: null }, [
      payment('p1'),
      undelivered,
    ]) as never,
    res as never,
  )
  assert.deepEqual(payloads[0], { capture: 1, cancel: 0 })
  await assert.rejects(
    impact(req('pp_manual_cod', { capture_mode: 'x' }) as never, res as never),
    (e: any) => e.type === 'invalid_data',
  )
})

test('list is sorted by rank, then provider_id', async () => {
  stored.clear()
  stored.set('pp_manual_cod', { ...defaultSettings('pp_manual_cod'), id: 'mpps_cod', rank: 1 })
  const { res, payloads } = createResponse<any>()
  await list(createRequest({} as never, reg()), res as never)
  assert.deepEqual(
    payloads[0].providers.map((p: any) => p.provider_id),
    ['pp_manual_bank', 'pp_manual_cod'],
  )
})

const rankReq = (provider_ids: string[]) => createRequest({ validatedBody: { provider_ids } } as never, reg())

test('rank: sets each rank to its index and returns the sorted providers', async () => {
  stored.clear()
  const { res, payloads } = createResponse<any>()
  await rank(rankReq(['pp_manual_cod', 'pp_manual_bank']) as never, res as never)
  assert.deepEqual(
    payloads[0].providers.map((p: any) => [p.provider_id, p.settings.rank]),
    [
      ['pp_manual_cod', 0],
      ['pp_manual_bank', 1],
    ],
  )
})

test('rank: 400 unless provider_ids lists each registered manual provider exactly once', async () => {
  stored.clear()
  const { res } = createResponse()
  for (const ids of [
    [],
    ['pp_manual_cod'],
    ['pp_manual_cod', 'pp_manual_cod'],
    ['pp_manual_cod', 'pp_manual_bank', 'pp_manual_cod'],
    ['pp_manual_cod', 'pp_stripe_stripe'],
    ['pp_manual_cod', 'pp_manual_bank', 'pp_manual_x'],
  ]) {
    await assert.rejects(rank(rankReq(ids) as never, res as never), (e: any) => e.type === 'invalid_data')
  }
  assert.equal(stored.size, 0)
})
