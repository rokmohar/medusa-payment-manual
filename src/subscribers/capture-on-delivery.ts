import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import { capturePaymentWorkflow } from '@medusajs/medusa/core-flows'
import { z } from 'zod'
import { captureEligiblePayments, type CaptureFlows } from '../lib/capture'
import { parseRow } from '../lib/parse'

const payloadSchema = z.object({ id: z.string() }) // the fulfillment
const orderSchema = z.array(z.object({ order_id: z.string() }))

export const createCaptureOnDeliveryHandler = (flows: CaptureFlows = { capturePaymentWorkflow }) => {
  return async ({ event, container }: SubscriberArgs<unknown>): Promise<void> => {
    try {
      const { id } = parseRow(payloadSchema, event.data, `${event.name} payload`)
      const { data } = await container
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({ entity: 'order_fulfillment', fields: ['order_id'], filters: { fulfillment_id: id } })
      const links = parseRow(orderSchema, data, `order of fulfillment ${id}`)

      if (links.length) {
        await captureEligiblePayments(container, flows, { order_id: links[0].order_id, modes: ['on_delivery'] })
      }
    } catch (e) {
      container
        .resolve(ContainerRegistrationKeys.LOGGER)
        .error(
          `manual-payment: capture on delivery failed on ${event.name} ${JSON.stringify(event.data)}`,
          e instanceof Error ? e : new Error(String(e)),
        )
    }
  }
}

export default createCaptureOnDeliveryHandler()

// The every-minute capture job catches up a missed event.
export const config: SubscriberConfig = {
  event: 'delivery.created',
  context: { subscriberId: 'manual-payment-capture-on-delivery' },
}
