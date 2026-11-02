import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Modules } from '@medusajs/framework/utils'
import { createCancelUnpaidOrdersJob } from '../../src/jobs/cancel-unpaid-manual-orders'
import { createCaptureJob } from '../../src/jobs/capture-manual-payments'
import { defaultSettings } from '../../src/lib/settings'
import type { ProviderSettings } from '../../src/lib/types'
import { createRequest, QUERY_KEY } from './support/routes'

const P = 'pp_manual_cod'
type OrderOverrides = { status?: string; fulfillments?: unknown[]; payments?: unknown[] }
const row = (id: string, order: string, o: OrderOverrides = {}) => ({
  id,
  provider_id: P,
  captures: [],
  refunds: [],
  payment_collection: {
    order: {
      id: order,
      created_at: '2020-01-01T00:00:00Z',
      status: o.status ?? 'pending',
      fulfillments: o.fulfillments ?? [],
      payment_collections: [{ payments: o.payments ?? [{ id, captures: [] }] }],
    },
  },
})
const spy = (calls: unknown[]) => () => ({
  run: async ({ input }: { input: unknown }) => {
    calls.push(input)
  },
})
const ON_ORDER = { ...defaultSettings(P), capture_mode: 'on_order' as const }
const ON_DELIVERY = { ...defaultSettings(P), capture_mode: 'on_delivery' as const }
const CANCEL = { ...defaultSettings(P), auto_cancel_enabled: true, auto_cancel_days: 7 }
const captured = async (s: ProviderSettings, rows: unknown[]) => {
  const calls: unknown[] = []

  await createCaptureJob({ capturePaymentWorkflow: spy(calls) } as never)(setup([s], rows).container)

  return calls
}
const canceled = async (rows: unknown[]) => {
  const calls: unknown[] = []

  await createCancelUnpaidOrdersJob({ cancelOrderWorkflow: spy(calls) } as never)(setup([CANCEL], rows).container)

  return calls
}

const setup = (settings: ProviderSettings[], rows: unknown[]) => {
  const errors: unknown[][] = []
  const queries: string[] = []
  const container = createRequest(
    {},
    {
      manual_payment: { listSettings: async () => settings },
      logger: { error: (...args: unknown[]) => errors.push(args) },
      [Modules.LOCKING]: { execute: async (_key: string, job: () => Promise<unknown>) => job() },
      [QUERY_KEY]: {
        graph: async ({ entity, filters }: { entity: string; filters: Record<string, unknown> }) => {
          queries.push(entity)

          type R = { id: string; payment_collection: { order: { id: string } } }
          const all = rows as R[]

          if (entity === 'order') {
            const mine = all.filter((r) => r.payment_collection.order.id === filters.id)

            return { data: [{ payment_collections: [{ payments: mine.map((r) => ({ id: r.id })) }] }] }
          }

          const ids = filters.id as string[] | undefined

          return { data: all.filter((r) => !ids || ids.includes(r.id)) }
        },
      },
    },
  ).scope as never

  return { container, errors, queries }
}

test('capture job captures each selected payment and survives a failure', async () => {
  const { container, errors } = setup(
    [{ ...defaultSettings(P), capture_mode: 'on_order' }],
    [row('pay_1', 'o1'), row('pay_2', 'o2')],
  )
  const calls: unknown[] = []
  const boom = new Error('boom')
  const job = createCaptureJob({
    capturePaymentWorkflow: () => ({
      run: async ({ input }: { input: { payment_id: string } }) => {
        calls.push(input)

        if (input.payment_id === 'pay_1') {
          throw boom
        }
      },
    }),
  } as never)

  await job(container)
  assert.deepEqual(calls, [{ payment_id: 'pay_1' }, { payment_id: 'pay_2' }])
  // The Error itself is passed so Medusa's logger records its stack.
  assert.deepEqual(errors, [['manual-payment: capture failed for pay_1', boom]])
  assert.equal(errors[0][1], boom)
})

test('cancel job logs a failure with the error and moves on', async () => {
  const { container, errors } = setup([CANCEL], [row('pay_1', 'o1'), row('pay_2', 'o2')])
  const calls: unknown[] = []

  await createCancelUnpaidOrdersJob({
    cancelOrderWorkflow: () => ({
      run: async ({ input }: { input: { order_id: string } }) => {
        calls.push(input)

        if (input.order_id === 'o1') {
          throw 'not an error'
        }
      },
    }),
  } as never)(container)

  assert.deepEqual(calls, [{ order_id: 'o1' }, { order_id: 'o2' }])
  assert.equal(errors.length, 1)
  assert.equal(errors[0][0], 'manual-payment: auto-cancel failed for o1')
  assert.ok(errors[0][1] instanceof Error)
  assert.equal((errors[0][1] as Error).message, 'not an error')
})

test('jobs do nothing when no provider has the feature on', async () => {
  const { container, queries } = setup([defaultSettings(P)], [row('pay_1', 'o1')])
  const never = () => ({ run: async () => assert.fail('must not run') })

  await createCaptureJob({ capturePaymentWorkflow: never } as never)(container)
  await createCancelUnpaidOrdersJob({ cancelOrderWorkflow: never } as never)(container)
  assert.deepEqual(queries, [])
})

test('cancel job cancels old unpaid orders once', async () => {
  const { container } = setup(
    [{ ...defaultSettings(P), auto_cancel_enabled: true, auto_cancel_days: 7 }],
    [row('pay_1', 'o1'), row('pay_2', 'o1')],
  )
  const calls: unknown[] = []

  await createCancelUnpaidOrdersJob({
    cancelOrderWorkflow: () => ({
      run: async ({ input }: { input: unknown }) => {
        calls.push(input)
      },
    }),
  } as never)(container)
  assert.deepEqual(calls, [{ order_id: 'o1' }])
})

test('cancel job skips orders with a capture on another payment', async () => {
  const payments = [
    { id: 'pay_1', captures: [] },
    { id: 'pay_stripe', captures: [{ id: 'capt_1' }] },
  ]

  assert.deepEqual(await canceled([row('pay_1', 'o1', { payments })]), [])
})

test('cancel job skips orders with a live fulfillment, and non-cancelable statuses', async () => {
  const fulfillments = [{ id: 'f1', delivered_at: null, canceled_at: null }]

  assert.deepEqual(await canceled([row('pay_1', 'o1', { fulfillments })]), [])
  assert.deepEqual(await canceled([row('pay_1', 'o1', { status: 'completed' })]), [])
  assert.deepEqual(await canceled([row('pay_1', 'o1', { status: 'draft' })]), [])
  assert.deepEqual(await canceled([row('pay_1', 'o1', { fulfillments: [{ id: 'f1', canceled_at: '2020-01-02' }] })]), [
    { order_id: 'o1' },
  ])
})

test('on_delivery capture ignores canceled deliveries', async () => {
  const canceledDelivery = [{ id: 'f1', delivered_at: '2020-01-02', canceled_at: '2020-01-03' }]
  const delivery = [{ id: 'f2', delivered_at: '2020-01-02', canceled_at: null }]

  assert.deepEqual(await captured(ON_DELIVERY, [row('pay_1', 'o1', { fulfillments: canceledDelivery })]), [])
  assert.deepEqual(await captured(ON_DELIVERY, [row('pay_1', 'o1', { fulfillments: delivery })]), [
    { payment_id: 'pay_1' },
  ])
})

test('capture respects order status', async () => {
  assert.deepEqual(await captured(ON_ORDER, [row('pay_1', 'o1', { status: 'draft' })]), [])
  assert.deepEqual(await captured(ON_ORDER, [row('pay_1', 'o1', { status: 'completed' })]), [{ payment_id: 'pay_1' }])
})
