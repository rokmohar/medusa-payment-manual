import assert from 'node:assert/strict'
import { test } from 'node:test'
import handler, { config } from '../../src/subscribers/order-placed'

test('subscriber has a plugin-scoped id that cannot collide with app subscribers', () => {
  assert.equal(config.event, 'order.placed')
  assert.equal(config.context?.subscriberId, 'manual-payment-order-placed')
  assert.equal(handler.name, 'manualPaymentOrderPlacedHandler')
})

test('a failed snapshot is logged with the error', async () => {
  const errors: unknown[][] = []
  const boom = new Error('boom')
  const container = {
    resolve: (key: string) => {
      if (key === 'logger') {
        return { error: (...args: unknown[]) => errors.push(args) }
      }

      throw boom
    },
  }

  await handler({ event: { data: { id: 'order_1' } }, container } as never)
  assert.deepEqual(errors, [['manual-payment: snapshot failed for order_1', boom]])
})
