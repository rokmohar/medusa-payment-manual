import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Modules } from '@medusajs/framework/utils'
import { feeItemsToMark, markFeeFulfilled, type FeeOrder } from '../../src/lib/fee-fulfillment'
import handler, { config } from '../../src/subscribers/fee-fulfillment'
import { createRequest, QUERY_KEY } from './support/routes'

type Item = NonNullable<FeeOrder['items']>[number]

const product = (id: string, quantity: number, fulfilled: number): Item => ({
  id,
  quantity,
  variant_id: `variant_${id}`,
  metadata: null,
  detail: { fulfilled_quantity: fulfilled },
})
const fee = (id: string, fulfilled = 0, quantity = 1): Item => ({
  id,
  quantity,
  variant_id: null,
  metadata: { manual_payment_fee: 'pp_manual_cod' },
  detail: { fulfilled_quantity: fulfilled },
})
const order = (items: Item[], status = 'pending'): FeeOrder => ({ id: 'order_1', status, items })

test('marks the unfulfilled fee item and ignores product items', () => {
  assert.deepEqual(feeItemsToMark(order([product('p', 2, 0), fee('fee')])), [{ id: 'fee', quantity: 1 }])
  assert.deepEqual(feeItemsToMark(order([product('p', 1, 0)])), [])
  assert.deepEqual(feeItemsToMark(order([])), [])
})

test('an already fulfilled fee needs nothing', () => {
  assert.deepEqual(feeItemsToMark(order([product('p', 1, 1), fee('fee', 1)])), [])
})

test('marks only the remaining quantity of each fee item', () => {
  assert.deepEqual(feeItemsToMark(order([fee('fee_a', 1), fee('fee_b', 1, 3)])), [{ id: 'fee_b', quantity: 2 }])
})

test('canceled orders are left alone', () => {
  assert.deepEqual(feeItemsToMark(order([product('p', 1, 0), fee('fee')], 'canceled')), [])
})

test('only variant-less items with the fee metadata count as fee items', () => {
  // A storefront can set the metadata on a product item; it stays a product to fulfil.
  const spoofed = { ...product('p', 1, 0), metadata: { manual_payment_fee: 'pp_manual_cod' } }
  const notString = { ...fee('x'), metadata: { manual_payment_fee: true } }

  assert.deepEqual(feeItemsToMark(order([spoofed, notString])), [])
})

// Runner and subscriber, against a fake container.
const fakeContainer = (state: FeeOrder | null, register?: () => Promise<void>) => {
  const errors: unknown[][] = []
  const lockKeys: string[] = []
  const registered: unknown[] = []
  const container = createRequest(
    {},
    {
      logger: { error: (...args: unknown[]) => errors.push(args) },
      [Modules.LOCKING]: {
        execute: async (key: string, job: () => Promise<unknown>) => {
          lockKeys.push(key)

          return job()
        },
      },
      [Modules.ORDER]: {
        registerFulfillment: async (data: unknown) => {
          registered.push(data)
          await register?.()
        },
      },
      [QUERY_KEY]: {
        graph: async () => {
          return { data: state ? [state] : [] }
        },
      },
    },
  ).scope as never

  return { container, errors, lockKeys, registered }
}

test('registers the fee fulfillment once, without a fulfillment record, under a per-order lock', async () => {
  const { container, lockKeys, registered } = fakeContainer(order([product('p', 1, 0), fee('fee')]))

  await markFeeFulfilled(container, 'order_1')
  assert.deepEqual(lockKeys, ['manual-payment-fee-fulfilled:order_1'])
  assert.deepEqual(registered, [{ order_id: 'order_1', items: [{ id: 'fee', quantity: 1 }] }])
})

test('registers nothing when there is nothing to mark or the order is missing', async () => {
  const done = fakeContainer(order([product('p', 1, 0), fee('fee', 1)]))
  const missing = fakeContainer(null)

  await markFeeFulfilled(done.container, 'order_1')
  await markFeeFulfilled(missing.container, 'order_missing')
  assert.deepEqual(done.registered, [])
  assert.deepEqual(missing.registered, [])
})

test('subscriber runs on order placement and on fulfillment as a catch-up, under a plugin-scoped id', async () => {
  assert.deepEqual(config.event, ['order.placed', 'order.fulfillment_created'])
  assert.equal(config.context?.subscriberId, 'manual-payment-fee-fulfilled')

  const { container, errors, registered } = fakeContainer(order([product('p', 1, 0), fee('fee')]))

  await handler({ event: { name: 'order.placed', data: { id: 'order_1' } }, container } as never)
  await handler({
    event: { name: 'order.fulfillment_created', data: { order_id: 'order_1', fulfillment_id: 'ful_1' } },
    container,
  } as never)
  assert.deepEqual(registered, [
    { order_id: 'order_1', items: [{ id: 'fee', quantity: 1 }] },
    { order_id: 'order_1', items: [{ id: 'fee', quantity: 1 }] },
  ])
  assert.deepEqual(errors, [])
})

test('subscriber logs a failure with the error and never throws', async () => {
  const boom = new Error('boom')
  const { container, errors } = fakeContainer(order([fee('fee')]), async () => {
    throw boom
  })

  await handler({ event: { name: 'order.placed', data: { id: 'order_1' } }, container } as never)
  await handler({ event: { name: 'order.fulfillment_created', data: { nope: 1 } }, container } as never)
  assert.equal(errors.length, 2)
  assert.deepEqual(errors[0], [
    `manual-payment: marking the fee fulfilled failed on order.placed {"id":"order_1"}`,
    boom,
  ])
  assert.ok(errors[1][1] instanceof Error)
})
