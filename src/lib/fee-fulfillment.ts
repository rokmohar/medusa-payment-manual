import type { ILockingModule, IOrderModuleService, MedusaContainer } from '@medusajs/framework/types'
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils'
import { z } from 'zod'
import { feeProviderOf } from './fee'
import { numeric, parseRow } from './parse'

const FIELDS = [
  'id',
  'status',
  'items.id',
  'items.quantity',
  'items.variant_id',
  'items.metadata',
  'items.detail.fulfilled_quantity',
]

const orderSchema = z.object({
  id: z.string(),
  status: z.string(),
  items: z
    .array(
      z.object({
        id: z.string(),
        quantity: numeric,
        variant_id: z.string().nullish(),
        metadata: z.record(z.string(), z.unknown()).nullish(),
        detail: z.object({ fulfilled_quantity: numeric }),
      }),
    )
    .nullish(),
})

export type FeeOrder = z.output<typeof orderSchema>

/**
 * The fee items still counted as unfulfilled, with their remaining quantity. Identified as in the cart: store clients
 * can set metadata but cannot add variant-less items.
 */
export const feeItemsToMark = (order: FeeOrder): { id: string; quantity: number }[] => {
  if (order.status === 'canceled') {
    return []
  }

  return (order.items ?? []).flatMap((i) => {
    const remaining = i.quantity - i.detail.fulfilled_quantity

    return feeProviderOf(i) && remaining > 0 ? [{ id: i.id, quantity: remaining }] : []
  })
}

const loadFeeOrder = async (container: MedusaContainer, order_id: string): Promise<FeeOrder | null> => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: 'order', fields: FIELDS, filters: { id: order_id } })

  return data.length ? parseRow(orderSchema, data[0], `order ${order_id}`) : null
}

/**
 * Marks the fee items fulfilled through the order module's registerFulfillment: their fulfilled quantity is set
 * without creating a fulfillment, so Medusa's fulfillment status is decided by the product fulfillments alone. A lock
 * per order keeps concurrent events from registering twice; once marked, nothing is left to do.
 */
export const markFeeFulfilled = async (container: MedusaContainer, order_id: string): Promise<void> => {
  const locking = container.resolve<ILockingModule>(Modules.LOCKING)

  await locking.execute(
    `manual-payment-fee-fulfilled:${order_id}`,
    async () => {
      const order = await loadFeeOrder(container, order_id)
      const items = order ? feeItemsToMark(order) : []

      if (items.length) {
        await container.resolve<IOrderModuleService>(Modules.ORDER).registerFulfillment({ order_id, items })
      }
    },
    { timeout: 30 },
  )
}
