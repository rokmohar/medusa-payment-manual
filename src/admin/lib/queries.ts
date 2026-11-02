import { FetchError } from '@medusajs/js-sdk'
import { toast } from '@medusajs/ui'
import { queryOptions, useIsMutating, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Choice } from '../../lib/choices'
import type { PaymentType } from '../../lib/payment-type'
import type { ProviderSettings } from '../../lib/types'
import { sdk } from './sdk'

export type AmountCurrency = { code: string; name: string; symbol: string; decimal_digits: number }

// Mirrors AdminProvidersResponse in the route; importing the route would pull server decorators into the admin build.
export type ManualProvider = {
  provider_id: string
  is_enabled: boolean
  type: PaymentType
  settings: ProviderSettings | null
}
/** The provider's settings; `id` is set once they are saved (translations reference it). */
export type AdminSettings = ProviderSettings & { id?: string }
export type Impact = { capture: number; cancel: number }

const path = (id: string) => {
  return `/admin/manual-payments/${encodeURIComponent(id)}`
}

const keys = {
  providers: ['manual-payments', 'providers'],
  rank: ['manual-payments', 'rank'],
  save: (id: string) => {
    return ['manual-payments', 'save', id]
  },
}

// Same as the dashboard's query client.
const retry = 1

const settingsQuery = (id: string) => {
  return queryOptions({
    queryKey: ['manual-payments', 'settings', id],
    queryFn: async () => {
      return sdk.client.fetch<{ settings: AdminSettings }>(path(id))
    },
    retry,
  })
}

export const messageOf = (err: unknown): string => {
  return err instanceof Error ? err.message : 'Unknown error'
}

export const isNotFound = (err: unknown): boolean => {
  return err instanceof FetchError && err.status === 404
}

export const useManualProviders = () => {
  return useQuery({
    queryKey: keys.providers,
    queryFn: async () => {
      return sdk.client.fetch<{ providers: ManualProvider[] }>('/admin/manual-payments')
    },
    retry,
  })
}

/** Posts the full provider order; each provider's rank becomes its index. Errors are toasted here. */
export const useRankProviders = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: keys.rank,
    mutationFn: async (provider_ids: string[]) => {
      return sdk.client.fetch<{ providers: ManualProvider[] }>('/admin/manual-payments/rank', {
        method: 'POST',
        body: { provider_ids },
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: keys.providers })
    },
    onError: (err) => {
      toast.error(messageOf(err))
    },
  })
}

/** True while a reorder is in flight; the list locks its Move actions meanwhile. */
export const useIsRanking = (): boolean => {
  return useIsMutating({ mutationKey: keys.rank }) > 0
}

export const useProviderSettings = (id: string) => {
  return useQuery(settingsQuery(id))
}

/**
 * The API only replaces the whole settings, so `update` is applied to the latest settings, fetched right before the
 * POST: a section never reverts changes made meanwhile by another section or tab. Errors are toasted here.
 */
export const useSaveSettings = (id: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: keys.save(id),
    mutationFn: async (update: (latest: AdminSettings) => AdminSettings) => {
      const latest = await queryClient.fetchQuery({ ...settingsQuery(id), staleTime: 0 })
      const { provider_id: _provider_id, id: _id, ...body } = update(latest.settings)

      return sdk.client.fetch<{ settings: AdminSettings }>(path(id), { method: 'POST', body })
    },
    onSuccess: async (data) => {
      queryClient.setQueryData(settingsQuery(id).queryKey, data)
      await queryClient.invalidateQueries({ queryKey: keys.providers })
    },
    onError: (err) => {
      toast.error(messageOf(err))
    },
  })
}

/** Whether Medusa's `translation` feature flag is on (the public endpoint the dashboard reads its flags from). */
export const useTranslationEnabled = (): boolean => {
  const { data } = useQuery({
    queryKey: ['manual-payments', 'feature-flags'],
    retry,
    queryFn: async () => {
      return sdk.client.fetch<{ feature_flags: Record<string, boolean> }>('/admin/feature-flags')
    },
  })

  return data?.feature_flags.translation === true
}

/** True while any save of this provider's settings is in flight; sections lock their actions meanwhile. */
export const useIsSaving = (id: string): boolean => {
  return useIsMutating({ mutationKey: keys.save(id) }) > 0
}

/** Dry run of the capture/cancel jobs with the proposed values. */
export const useImpact = (id: string) => {
  return useMutation({
    mutationFn: async (s: Pick<ProviderSettings, 'capture_mode' | 'auto_cancel_enabled' | 'auto_cancel_days'>) => {
      return sdk.client.fetch<Impact>(`${path(id)}/impact`, {
        method: 'POST',
        body: {
          capture_mode: s.capture_mode,
          auto_cancel_enabled: s.auto_cancel_enabled,
          auto_cancel_days: s.auto_cancel_days,
        },
      })
    },
    onError: (err) => {
      toast.error(messageOf(err))
    },
  })
}

export type Choices = { countries: Choice[]; shippingOptions: Choice[]; currencies: AmountCurrency[] }

export const useChoices = (): Choices => {
  const countries = useQuery({
    queryKey: ['manual-payments', 'countries'],
    retry,
    queryFn: async (): Promise<Choice[]> => {
      const { regions } = await sdk.admin.region.list({
        fields: 'id,name,countries.iso_2,countries.display_name',
        limit: 100,
      })
      const map = new Map<string, string>()

      for (const c of regions.flatMap((r) => {
        return r.countries ?? []
      })) {
        if (c.iso_2) {
          map.set(c.iso_2, c.display_name ?? c.iso_2.toUpperCase())
        }
      }

      return [...map]
        .map(([code, name]) => {
          return { code, name }
        })
        .sort((a, b) => {
          return a.name.localeCompare(b.name)
        })
    },
  })
  const shippingOptions = useQuery({
    queryKey: ['manual-payments', 'shipping-options'],
    retry,
    queryFn: async (): Promise<Choice[]> => {
      const { shipping_options } = await sdk.admin.shippingOption.list({ limit: 100 })

      return shipping_options.map((o) => {
        return { code: o.id, name: o.name }
      })
    },
  })

  // The store's supported currencies, with their metadata (the default fields include `supported_currencies.currency`).
  const currencies = useQuery({
    queryKey: ['manual-payments', 'currencies'],
    retry,
    queryFn: async (): Promise<AmountCurrency[]> => {
      const { stores } = await sdk.admin.store.list()

      return (stores[0]?.supported_currencies ?? []).map((c) => {
        return {
          code: c.currency_code,
          name: c.currency.name,
          symbol: c.currency.symbol_native,
          decimal_digits: c.currency.decimal_digits,
        }
      })
    },
  })

  return {
    countries: countries.data ?? [],
    shippingOptions: shippingOptions.data ?? [],
    currencies: currencies.data ?? [],
  }
}
