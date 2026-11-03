import { MathBN } from '@medusajs/framework/utils'
import type { ProviderSettings } from './types'

// Line item metadata key marking the plugin's fee item; the value is the provider id the fee belongs to.
export const FEE_METADATA_KEY = 'manual_payment_fee'

/**
 * The provider id when the item is our payment fee, else null. Store clients can set line item metadata but cannot add
 * variant-less items, so only a variant-less item carrying the key is trusted.
 */
export const feeProviderOf = (item: {
  metadata?: Record<string, unknown> | null
  variant_id?: string | null
}): string | null => {
  const provider_id = item.metadata?.[FEE_METADATA_KEY]

  return typeof provider_id === 'string' && !item.variant_id ? provider_id : null
}

export const DEFAULT_FEE_LABEL = 'Payment Fee'

/** The fee line item title for a (translated) fee label. */
export const feeTitle = (label: string | null | undefined): string => {
  const title = label?.trim() ?? ''

  return title.length ? title : DEFAULT_FEE_LABEL
}

export type FeeItem = { id: string; provider_id: string; unit_price: number; title: string }

export const feeAmount = (settings: ProviderSettings | null, currency_code: string): number | null => {
  const amount = settings?.fee?.[currency_code.toLowerCase()]

  return amount !== undefined && amount > 0 ? amount : null
}

// Keeps at most one fee item: the selected provider's, while it matches the configured fee and label in the
// cart currency. Anything else (other providers, duplicates, stale amount or label) is removed and re-added. Pass the
// settings with the fee label translated for the cart, so an item titled for another locale is replaced too.
export const planFee = (input: {
  provider_id: string
  currency_code: string
  fee_items: FeeItem[]
  settings: ProviderSettings | null
}): { remove: string[]; add: { amount: number; title: string } | null } => {
  const { provider_id, currency_code, fee_items, settings } = input
  const amount = feeAmount(settings, currency_code)
  const title = feeTitle(settings?.fee_label)
  const keep =
    amount === null
      ? undefined
      : fee_items.find((i) => {
          return i.provider_id === provider_id && i.title === title && MathBN.eq(i.unit_price, amount)
        })

  return {
    remove: fee_items
      .filter((i) => {
        return i !== keep
      })
      .map((i) => {
        return i.id
      }),
    add: amount === null || keep ? null : { amount, title },
  }
}
