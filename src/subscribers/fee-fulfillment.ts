import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import { z } from 'zod'
import { markFeeFulfilled } from '../lib/fee-fulfillment'
import { parseRow } from '../lib/parse'

// order.placed carries the order as `id`, order.fulfillment_created as `order_id`.
const payloadSchema = z.union([z.object({ order_id: z.string() }), z.object({ id: z.string() })])

export default async function manualPaymentFeeFulfilledHandler({ event, container }: SubscriberArgs<unknown>) {
  try {
    const payload = parseRow(payloadSchema, event.data, `${event.name} payload`)

    await markFeeFulfilled(container, 'order_id' in payload ? payload.order_id : payload.id)
  } catch (e) {
    container
      .resolve(ContainerRegistrationKeys.LOGGER)
      .error(
        `manual-payment: marking the fee fulfilled failed on ${event.name} ${JSON.stringify(event.data)}`,
        e instanceof Error ? e : new Error(String(e)),
      )
  }
}

// order.fulfillment_created catches up an order whose order.placed was missed.
export const config: SubscriberConfig = {
  event: ['order.placed', 'order.fulfillment_created'],
  context: { subscriberId: 'manual-payment-fee-fulfilled' },
}
