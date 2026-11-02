import type { MedusaContainer } from '@medusajs/framework/types'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import { z } from 'zod'
import { parseRow } from './parse'
import type { PaymentCandidate } from './selection'

export type { PaymentCandidate }

const FIELDS = [
  'id',
  'provider_id',
  'captures.id',
  'refunds.id',
  'payment_collection.order.id',
  'payment_collection.order.created_at',
  'payment_collection.order.status',
  'payment_collection.order.payment_collections.payments.captures.id',
  'payment_collection.order.fulfillments.id',
  'payment_collection.order.fulfillments.delivered_at',
  'payment_collection.order.fulfillments.canceled_at',
]

const paymentSchema = z.object({
  id: z.string(),
  provider_id: z.string(),
  captures: z.array(z.unknown()).nullish(),
  refunds: z.array(z.unknown()).nullish(),
  payment_collection: z
    .object({
      order: z
        .object({
          id: z.string(),
          created_at: z.coerce.date(),
          status: z.string(),
          payment_collections: z
            .array(
              z.object({
                payments: z.array(z.object({ captures: z.array(z.unknown()).nullish() })).nullish(),
              }),
            )
            .nullish(),
          fulfillments: z
            .array(z.object({ delivered_at: z.unknown().optional(), canceled_at: z.unknown().optional() }))
            .nullish(),
        })
        .nullish(),
    })
    .nullish(),
})

const orderPaymentsSchema = z.array(
  z.object({
    payment_collections: z.array(z.object({ payments: z.array(z.object({ id: z.string() })).nullish() })).nullish(),
  }),
)

// Uncaptured, non-canceled payments of the given providers that belong to an order.
// payment_collection.order is the reverse alias of the order <-> payment_collection link.
// Pass order_id to restrict to the payments of one order.
// ponytail: loads every uncaptured, non-canceled payment of these providers on each run (capture job every minute,
// cancel job hourly, admin impact preview); paginate with skip/take if that volume grows large.
export const loadPaymentCandidates = async (
  container: MedusaContainer,
  provider_ids: string[],
  order_id?: string,
): Promise<PaymentCandidate[]> => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const filters: Record<string, unknown> = { provider_id: provider_ids, captured_at: null, canceled_at: null }

  if (order_id) {
    const { data: orders } = await query.graph({
      entity: 'order',
      fields: ['payment_collections.payments.id'],
      filters: { id: order_id },
    })

    const ids = parseRow(orderPaymentsSchema, orders, `order ${order_id}`).flatMap((o) => {
      return (o.payment_collections ?? []).flatMap((pc) => {
        return (pc.payments ?? []).map((p) => {
          return p.id
        })
      })
    })

    // An empty id filter must never widen the query to every order.
    if (!ids.length) {
      return []
    }

    filters.id = ids
  }

  const { data } = await query.graph({ entity: 'payment', fields: FIELDS, filters })
  const out: PaymentCandidate[] = []

  for (const raw of data) {
    const p = parseRow(paymentSchema, raw, 'payment')
    const order = p.payment_collection?.order

    if (!order) {
      continue
    }

    const live = (order.fulfillments ?? []).filter((f) => {
      return !f.canceled_at
    })

    out.push({
      payment_id: p.id,
      provider_id: p.provider_id,
      order_id: order.id,
      order_created_at: order.created_at,
      order_status: order.status,
      order_has_capture: (order.payment_collections ?? []).some((pc) => {
        return (pc.payments ?? []).some((pay) => {
          return !!pay.captures?.length
        })
      }),
      payment_canceled: false,
      has_capture: !!p.captures?.length,
      has_refund: !!p.refunds?.length,
      has_fulfillment: live.length > 0,
      has_delivered_fulfillment: live.some((f) => {
        return !!f.delivered_at
      }),
    })
  }

  return out
}
