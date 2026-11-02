import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Modules } from '@medusajs/framework/utils'
import { captureEligiblePayments } from '../../src/lib/capture'
import { defaultSettings } from '../../src/lib/settings'
import type { ProviderSettings } from '../../src/lib/types'
import handler, { config, createCaptureOnDeliveryHandler } from '../../src/subscribers/capture-on-delivery'
import { createRequest, QUERY_KEY } from './support/routes'

const P = 'pp_manual_cod'
const ON_DELIVERY = { ...defaultSettings(P), capture_mode: 'on_delivery' as const }
const delivered = [{ id: 'f1', delivered_at: '2020-01-02', canceled_at: null }]
const row = (
  id: string,
  order: string,
  o: { status?: string; fulfillments?: unknown[]; captures?: unknown[] } = {},
) => ({
  id,
  provider_id: P,
  captures: o.captures ?? [],
  refunds: [],
  payment_collection: {
    order: {
      id: order,
      created_at: '2020-01-01T00:00:00Z',
      status: o.status ?? 'pending',
      fulfillments: o.fulfillments ?? delivered,
      payment_collections: [{ payments: [{ id, captures: o.captures ?? [] }] }],
    },
  },
})
type Row = ReturnType<typeof row>

const setup = (settings: ProviderSettings[], rows: Row[], beforeLock?: () => void) => {
  const errors: unknown[][] = []
  const infos: unknown[][] = []
  const lockKeys: string[] = []
  const calls: unknown[] = []
  const container = createRequest(
    {},
    {
      manual_payment: { listSettings: async () => settings },
      logger: { error: (...a: unknown[]) => errors.push(a), info: (...a: unknown[]) => infos.push(a) },
      [Modules.LOCKING]: {
        execute: async (key: string, job: () => Promise<unknown>) => {
          lockKeys.push(key)
          beforeLock?.()

          return job()
        },
      },
      [QUERY_KEY]: {
        graph: async ({ entity, filters }: { entity: string; filters: Record<string, unknown> }) => {
          if (entity === 'order_fulfillment') {
            return { data: filters.fulfillment_id === 'ful_1' ? [{ order_id: 'o1' }] : [] }
          }

          if (entity === 'order') {
            return {
              data: [
                {
                  id: filters.id,
                  payment_collections: [
                    {
                      payments: rows
                        .filter((r) => r.payment_collection.order.id === filters.id)
                        .map((r) => ({ id: r.id })),
                    },
                  ],
                },
              ],
            }
          }

          const ids = filters.id as string[] | undefined

          return { data: rows.filter((r) => !ids || ids.includes(r.id)) }
        },
      },
    },
  ).scope as never
  const flows = {
    capturePaymentWorkflow: () => ({
      run: async ({ input }: { input: unknown }) => {
        calls.push(input)
      },
    }),
  } as never

  return { container, flows, errors, infos, lockKeys, calls }
}

test('delivery.created captures the eligible on_delivery payment of that order under the order lock', async () => {
  const { container, flows, lockKeys, calls } = setup([ON_DELIVERY], [row('pay_1', 'o1'), row('pay_2', 'o2')])

  assert.equal(config.event, 'delivery.created')
  assert.equal(config.context?.subscriberId, 'manual-payment-capture-on-delivery')
  await createCaptureOnDeliveryHandler(flows)({
    event: { name: 'delivery.created', data: { id: 'ful_1' } },
    container,
  } as never)
  assert.deepEqual(calls, [{ payment_id: 'pay_1' }])
  assert.deepEqual(lockKeys, ['manual-payment-capture:o1'])
})

test('skips manual mode, captured, refunded and canceled orders', async () => {
  const none = async (s: ProviderSettings, r: Row) => {
    const { container, flows, calls } = setup([s], [r])

    await createCaptureOnDeliveryHandler(flows)({
      event: { name: 'delivery.created', data: { id: 'ful_1' } },
      container,
    } as never)

    return calls
  }

  assert.deepEqual(await none(defaultSettings(P), row('pay_1', 'o1')), [])
  assert.deepEqual(await none(ON_DELIVERY, row('pay_1', 'o1', { captures: [{ id: 'c' }] })), [])
  assert.deepEqual(await none(ON_DELIVERY, { ...row('pay_1', 'o1'), refunds: [{ id: 'r' }] } as never), [])
  assert.deepEqual(await none(ON_DELIVERY, row('pay_1', 'o1', { status: 'canceled' })), [])
  assert.deepEqual(await none(ON_DELIVERY, row('pay_1', 'o1', { fulfillments: [] })), [])
})

test('a payment captured while waiting for the lock is not captured again', async () => {
  const rows = [row('pay_1', 'o1')]
  const { container, flows, calls } = setup([ON_DELIVERY], rows, () => {
    rows[0] = row('pay_1', 'o1', { captures: [{ id: 'c' }] })
  })

  await captureEligiblePayments(container, flows)
  assert.deepEqual(calls, [])
})

test('the job path captures every order under its own lock key', async () => {
  const { container, flows, lockKeys, calls } = setup([ON_DELIVERY], [row('pay_1', 'o1'), row('pay_2', 'o2')])

  await captureEligiblePayments(container, flows)
  assert.deepEqual(calls, [{ payment_id: 'pay_1' }, { payment_id: 'pay_2' }])
  assert.deepEqual(lockKeys, ['manual-payment-capture:o1', 'manual-payment-capture:o2'])
})

test('failures are logged with the error and never thrown', async () => {
  const boom = new Error('boom')
  const { container, errors } = setup([ON_DELIVERY], [row('pay_1', 'o1')])
  const flows = {
    capturePaymentWorkflow: () => ({
      run: async () => {
        throw boom
      },
    }),
  } as never

  await createCaptureOnDeliveryHandler(flows)({
    event: { name: 'delivery.created', data: { id: 'ful_1' } },
    container,
  } as never)
  assert.deepEqual(errors, [['manual-payment: capture failed for pay_1', boom]])
  // A malformed payload and an unknown fulfillment are logged or ignored, never thrown.
  await handler({ event: { name: 'delivery.created', data: { nope: 1 } }, container } as never)
  assert.equal(errors.length, 2)
  assert.ok(errors[1][1] instanceof Error)
})

test('the delivery path leaves on_order payments to the job', async () => {
  const { container, flows, calls } = setup([{ ...defaultSettings(P), capture_mode: 'on_order' }], [row('pay_1', 'o1')])

  await createCaptureOnDeliveryHandler(flows)({
    event: { name: 'delivery.created', data: { id: 'ful_1' } },
    container,
  } as never)
  assert.deepEqual(calls, [])
  await captureEligiblePayments(container, flows)
  assert.deepEqual(calls, [{ payment_id: 'pay_1' }])
})

test('an unknown fulfillment captures nothing and logs nothing', async () => {
  const { container, flows, calls, errors, lockKeys } = setup([ON_DELIVERY], [row('pay_1', 'o1')])

  await createCaptureOnDeliveryHandler(flows)({
    event: { name: 'delivery.created', data: { id: 'ful_x' } },
    container,
  } as never)
  assert.deepEqual([calls, errors, lockKeys], [[], [], []])
})

test('an order without payments never widens the query to every order', async () => {
  const { container, flows, calls } = setup([ON_DELIVERY], [])

  await captureEligiblePayments(container, flows, { order_id: 'o_empty' })
  assert.deepEqual(calls, [])
})

test('an empty order id is never locked', async () => {
  const { container, flows, calls, lockKeys } = setup([ON_DELIVERY], [row('pay_1', '')])

  await captureEligiblePayments(container, flows)
  assert.deepEqual([calls, lockKeys], [[], []])
})

test('an order with several payments is locked once', async () => {
  const { container, flows, calls, lockKeys } = setup([ON_DELIVERY], [row('pay_1', 'o1'), row('pay_2', 'o1')])

  await captureEligiblePayments(container, flows)
  assert.deepEqual(calls, [{ payment_id: 'pay_1' }, { payment_id: 'pay_2' }])
  assert.deepEqual(lockKeys, ['manual-payment-capture:o1'])
})
