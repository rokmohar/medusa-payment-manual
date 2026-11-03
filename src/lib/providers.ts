import type { IPaymentModuleService, MedusaContainer } from '@medusajs/framework/types'
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils'
import { MANUAL_PAYMENT_MODULE } from '../modules/manual-payment'
import type ManualPaymentModuleService from '../modules/manual-payment/service'
import { type PaymentType, providerTypes } from './payment-type'
import { isManualProviderId } from './rules'
import type { StoredSettings } from './types'

export type AdminManualProvider = {
  provider_id: string
  is_enabled: boolean
  type: PaymentType
  settings: StoredSettings | null
}

/** By rank ascending, then provider_id; a provider without a settings row counts as rank 0. Returns a new array. */
export const sortByRank = <T extends { provider_id: string }>(
  providers: T[],
  settings: { provider_id: string; rank: number }[],
): T[] => {
  const ranks = new Map(
    settings.map((s) => {
      return [s.provider_id, s.rank]
    }),
  )

  return [...providers].sort((a, b) => {
    const diff = (ranks.get(a.provider_id) ?? 0) - (ranks.get(b.provider_id) ?? 0)

    return diff || a.provider_id.localeCompare(b.provider_id)
  })
}

/** The manual providers registered in the Payment Module, with their type and stored settings, sorted by rank. */
export const loadManualProviders = async (container: MedusaContainer): Promise<AdminManualProvider[]> => {
  const stored = await container.resolve<ManualPaymentModuleService>(MANUAL_PAYMENT_MODULE).listSettings()
  const registered = await container.resolve<IPaymentModuleService>(Modules.PAYMENT).listPaymentProviders()
  const types = providerTypes(container.resolve(ContainerRegistrationKeys.CONFIG_MODULE))
  const providers = registered
    .filter((p) => {
      return isManualProviderId(p.id)
    })
    .map((p) => {
      return {
        provider_id: p.id,
        is_enabled: p.is_enabled,
        type: types.get(p.id) ?? 'other',
        settings:
          stored.find((s) => {
            return s.provider_id === p.id
          }) ?? null,
      }
    })

  return sortByRank(providers, stored)
}

/**
 * The registered manual providers sorted by rank, e.g. to pick one automatically (the first enabled match). `enabled`
 * is the plugin setting (true while the provider has no saved settings).
 */
export const listManualProviders = async (
  container: MedusaContainer,
): Promise<{ provider_id: string; type: PaymentType; enabled: boolean; rank: number }[]> => {
  return (await loadManualProviders(container)).map((p) => {
    return {
      provider_id: p.provider_id,
      type: p.type,
      enabled: p.settings?.enabled ?? true,
      rank: p.settings?.rank ?? 0,
    }
  })
}
