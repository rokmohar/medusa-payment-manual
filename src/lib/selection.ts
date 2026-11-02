import type { ProviderSettings } from './types'

export type PaymentCandidate = {
  payment_id: string
  provider_id: string
  order_id: string
  order_created_at: Date
  order_status: string
  order_has_capture: boolean // a capture on ANY payment of the order, any provider
  payment_canceled: boolean
  has_capture: boolean
  has_refund: boolean
  has_fulfillment: boolean // any non-canceled fulfillment
  has_delivered_fulfillment: boolean // a non-canceled fulfillment with delivered_at
}

const DAY_MS = 86_400_000
const NOT_CAPTURABLE = new Set(['draft', 'canceled', 'archived'])
// cancelOrderWorkflow rejects completed orders; draft and archived orders are not ours to touch.
const CANCELABLE = new Set(['pending', 'requires_action'])

// Pure and exported: also the source of truth for the admin impact preview.
export const selectPaymentsToCapture = (c: PaymentCandidate[], s: Map<string, ProviderSettings>): string[] => {
  return c
    .filter((p) => {
      const mode = s.get(p.provider_id)?.capture_mode

      return (
        (mode === 'on_order' || (mode === 'on_delivery' && p.has_delivered_fulfillment)) &&
        !p.has_capture &&
        !p.has_refund &&
        !p.payment_canceled &&
        !NOT_CAPTURABLE.has(p.order_status)
      )
    })
    .map((p) => {
      return p.payment_id
    })
}

export const selectOrdersToCancel = (c: PaymentCandidate[], s: Map<string, ProviderSettings>, now: Date): string[] => {
  const ids = c
    .filter((p) => {
      const cfg = s.get(p.provider_id)
      const days = cfg?.auto_cancel_days

      return (
        !!cfg?.auto_cancel_enabled &&
        !!days &&
        days >= 1 &&
        now.getTime() - p.order_created_at.getTime() > days * DAY_MS &&
        !p.has_fulfillment &&
        !p.has_capture &&
        !p.order_has_capture &&
        CANCELABLE.has(p.order_status)
      )
    })
    .map((p) => {
      return p.order_id
    })

  return [...new Set(ids)]
}
