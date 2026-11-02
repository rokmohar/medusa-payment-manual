import type { ICartModuleService, MedusaContainer } from '@medusajs/framework/types'
import { ContainerRegistrationKeys, FeatureFlag, Modules } from '@medusajs/framework/utils'
import { z } from 'zod'
import { MANUAL_PAYMENT_MODULE } from '../modules/manual-payment'
import type ManualPaymentModuleService from '../modules/manual-payment/service'
import { feeProviderOf, feeTitle } from './fee'
import { parseRow } from './parse'
import { translateSettings } from './translations'

const cartSchema = z.object({
  locale: z.string().nullish(),
  items: z
    .array(
      z.object({
        id: z.string(),
        variant_id: z.string().nullish(),
        title: z.string(),
        metadata: z.record(z.string(), z.unknown()).nullish(),
      }),
    )
    .nullish(),
})

/**
 * Re-titles the cart's fee items for the cart's locale. Medusa re-translates only items with a variant when the locale
 * changes, so the variant-less fee item is ours to translate. Like Medusa, a cart without a locale is left alone: its
 * fee keeps the title it got for the request's locale, and so is everything without the translation feature.
 * Idempotent: only items whose title differs are updated.
 */
export const retitleFeeItems = async (container: MedusaContainer, cart_id: string): Promise<void> => {
  if (!FeatureFlag.isFeatureEnabled('translation')) {
    return
  }

  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: 'cart',
    fields: ['locale', 'items.id', 'items.variant_id', 'items.title', 'items.metadata'],
    filters: { id: cart_id },
  })
  const cart = data.length ? parseRow(cartSchema, data[0], `cart ${cart_id}`) : null

  if (!cart?.locale) {
    return
  }

  const svc = container.resolve<ManualPaymentModuleService>(MANUAL_PAYMENT_MODULE)
  const updates: { id: string; title: string }[] = []

  for (const item of cart.items ?? []) {
    const provider_id = feeProviderOf(item)

    if (provider_id) {
      const settings = await svc.getSettings(provider_id)
      const title = feeTitle((await translateSettings(container, settings, cart.locale)).fee_label)

      if (item.title !== title) {
        updates.push({ id: item.id, title })
      }
    }
  }

  if (updates.length) {
    await container.resolve<ICartModuleService>(Modules.CART).updateLineItems(updates)
  }
}
