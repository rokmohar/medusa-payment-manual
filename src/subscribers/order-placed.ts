import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import { ensureOrderPayment } from '../lib/order-payment'

export default async function manualPaymentOrderPlacedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  try {
    await ensureOrderPayment(container, data.id)
  } catch (e) {
    container
      .resolve(ContainerRegistrationKeys.LOGGER)
      .error(`manual-payment: snapshot failed for ${data.id}`, e instanceof Error ? e : new Error(String(e)))
  }
}

export const config: SubscriberConfig = {
  event: 'order.placed',
  context: { subscriberId: 'manual-payment-order-placed' },
}
