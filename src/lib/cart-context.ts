import type { MedusaContainer } from '@medusajs/framework/types'
import { ContainerRegistrationKeys, MathBN, MedusaError } from '@medusajs/framework/utils'
import { z } from 'zod'
import { feeProviderOf, type FeeItem } from './fee'
import { numeric, parseRow } from './parse'
import type { CartContext } from './types'

// Requesting `total` makes the cart module load items/shipping/tax relations and decorate cart and item totals.
const CART_FIELDS = [
  'id',
  'region_id',
  'currency_code',
  'locale',
  'total',
  'items.id',
  'items.variant_id',
  'items.unit_price',
  'items.title',
  'items.total',
  'items.metadata',
  'shipping_address.country_code',
  'shipping_methods.shipping_option_id',
  'payment_collection.payment_sessions.provider_id',
  'payment_collection.payment_sessions.status',
]

const cartSchema = z.object({
  id: z.string(),
  region_id: z.string().nullish(),
  currency_code: z.string(),
  locale: z.string().nullish(),
  total: numeric,
  items: z
    .array(
      z.object({
        id: z.string(),
        variant_id: z.string().nullish(),
        unit_price: numeric,
        title: z.string(),
        total: numeric,
        metadata: z.record(z.string(), z.unknown()).nullish(),
      }),
    )
    .nullish(),
  shipping_address: z.object({ country_code: z.string().nullish() }).nullish(),
  shipping_methods: z.array(z.object({ shipping_option_id: z.string().nullish() })).nullish(),
  payment_collection: z
    .object({ payment_sessions: z.array(z.object({ provider_id: z.string(), status: z.string() })).nullish() })
    .nullish(),
})

const pricePreferenceSchema = z.object({
  attribute: z.string(),
  value: z.string().nullable(),
  is_tax_inclusive: z.boolean(),
})

export type LoadedCart = {
  cart: CartContext
  region_id: string | null
  locale: string | null // the cart's locale (BCP 47), which Medusa translates the cart's items for
  fee_items: FeeItem[]
  session_provider_ids: string[] // providers of the non-canceled payment sessions
}

export const loadCartContext = async (container: MedusaContainer, cart_id: string): Promise<LoadedCart> => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: 'cart', fields: CART_FIELDS, filters: { id: cart_id } })

  if (!data.length) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Cart ${cart_id} not found`)
  }

  const row = parseRow(cartSchema, data[0], `cart ${cart_id}`)
  const fee_items: FeeItem[] = []
  const feeTotals: number[] = []

  for (const item of row.items ?? []) {
    const provider_id = feeProviderOf(item)

    if (provider_id) {
      fee_items.push({ id: item.id, provider_id, unit_price: item.unit_price, title: item.title })
      feeTotals.push(item.total)
    }
  }

  return {
    cart: {
      currency_code: row.currency_code,
      total: MathBN.sub(row.total, ...feeTotals).toNumber(), // exact decimal, not float subtraction
      country_code: row.shipping_address?.country_code?.toLowerCase() ?? null,
      shipping_option_ids: (row.shipping_methods ?? []).flatMap((m) => {
        return m.shipping_option_id ? [m.shipping_option_id] : []
      }),
    },
    region_id: row.region_id ?? null,
    locale: row.locale ?? null,
    fee_items,
    session_provider_ids: (row.payment_collection?.payment_sessions ?? [])
      .filter((s) => {
        return s.status !== 'canceled'
      })
      .map((s) => {
        return s.provider_id
      }),
  }
}

/**
 * Whether prices in the currency include tax: the pricing module's isTaxInclusive for a plain currency price, which uses
 * the currency_code price preference only (the region preference applies to region-rule prices). Default exclusive.
 */
export const currencyPricesIncludeTax = async (container: MedusaContainer, currency_code: string): Promise<boolean> => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: 'price_preference',
    fields: ['attribute', 'value', 'is_tax_inclusive'],
    filters: { attribute: 'currency_code', value: currency_code },
  })

  return (
    data
      .map((p) => {
        return parseRow(pricePreferenceSchema, p, 'price preference')
      })
      .find((p) => {
        return p.attribute === 'currency_code' && p.value === currency_code
      })?.is_tax_inclusive ?? false
  )
}

const paymentCollectionSchema = z.object({ cart: z.object({ id: z.string() }).nullish() })

export const cartIdOfPaymentCollection = async (
  container: MedusaContainer,
  payment_collection_id: string,
): Promise<string | null> => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: 'payment_collection',
    fields: ['cart.id'],
    filters: { id: payment_collection_id },
  })

  if (!data.length) {
    return null
  }

  return parseRow(paymentCollectionSchema, data[0], `payment collection ${payment_collection_id}`).cart?.id ?? null
}
