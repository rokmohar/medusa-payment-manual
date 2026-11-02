import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import { z } from 'zod'
import { retitleFeeItems } from '../lib/fee-title'
import { parseRow } from '../lib/parse'

const payloadSchema = z.object({ id: z.string() })

export default async function manualPaymentFeeTitleHandler({ event, container }: SubscriberArgs<unknown>) {
  try {
    await retitleFeeItems(container, parseRow(payloadSchema, event.data, `${event.name} payload`).id)
  } catch (e) {
    container
      .resolve(ContainerRegistrationKeys.LOGGER)
      .error(
        `manual-payment: re-titling the fee failed on ${event.name} ${JSON.stringify(event.data)}`,
        e instanceof Error ? e : new Error(String(e)),
      )
  }
}

// Every cart update (including a locale change) emits cart.updated with the cart id.
export const config: SubscriberConfig = {
  event: 'cart.updated',
  context: { subscriberId: 'manual-payment-fee-title' },
}
