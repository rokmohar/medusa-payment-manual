import type { MedusaContainer } from '@medusajs/framework/types'
import { MANUAL_PAYMENT_MODULE } from '../modules/manual-payment'
import type ManualPaymentModuleService from '../modules/manual-payment/service'
import { translateSettings } from './translations'

/**
 * provider_id → the provider's label translated for `locale` (else the stored label), trimmed; null when blank. One
 * entry per provider with saved settings; fall back to your own name for providers without an entry or a label.
 */
export const getProviderLabels = async (
  container: MedusaContainer,
  locale?: string | null,
): Promise<Record<string, string | null>> => {
  const all = await container.resolve<ManualPaymentModuleService>(MANUAL_PAYMENT_MODULE).listSettings()
  const entries = await Promise.all(
    all.map(async (settings): Promise<[string, string | null]> => {
      const label = (await translateSettings(container, settings, locale)).label?.trim()

      if (label) {
        return [settings.provider_id, label]
      }

      return [settings.provider_id, null]
    }),
  )

  return Object.fromEntries(entries)
}
