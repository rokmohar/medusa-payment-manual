// Display helpers for the admin pages. Pure: no React, no Node APIs.
import {
  SETTINGS_REFERENCE,
  type BankAccount,
  type CaptureMode,
  type CurrencyAmounts,
  type ProviderSettings,
  type QrType,
  type ReferenceScheme,
  type RuleMode,
} from './types'
import type { PaymentType } from './payment-type'

export const NONE = '–'

/** `pp_manual_cashOnDelivery` -> "Cash On Delivery" (camelCase, kebab-case and snake_case split, Title Case). */
export const providerDisplayName = (id: string): string => {
  const name = id.replace(/^pp_manual_/, '')
  const words = name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[\s_-]+/)
    .filter(Boolean)

  if (!words.length) {
    return id
  }

  return words
    .map((w) => {
      return w[0].toUpperCase() + w.slice(1)
    })
    .join(' ')
}

/** The name shown for a provider in the admin: its label, else the name derived from its id. */
export const providerLabel = (id: string, label?: string | null): string => {
  const trimmed = label?.trim()

  if (trimmed) {
    return trimmed
  }

  return providerDisplayName(id)
}

/**
 * An include/exclude rule (countries, currencies, shipping options) as "All", "Only SI, HR" or "All Except SI"; more
 * than 3 items are cut to "SI, HR, AT +2". `name` displays an item; by default its code in uppercase.
 */
export const summarizeRule = (
  mode: RuleMode | undefined,
  list: string[],
  name: (code: string) => string = (c) => {
    return c.toUpperCase()
  },
): string => {
  if (!mode || mode === 'all' || (mode === 'exclude' && !list.length)) {
    return 'All'
  }

  if (!list.length) {
    return 'None'
  }

  const shown = list.slice(0, 3).map(name)
  const more = list.length - shown.length

  return `${mode === 'include' ? 'Only' : 'All Except'} ${shown.join(', ')}${more > 0 ? ` +${more}` : ''}`
}

/** Amounts per currency, each formatted in its currency; "–" when there are none. */
export const formatAmounts = (map: CurrencyAmounts | null, locale?: string): string => {
  const entries = Object.entries(map ?? {})

  if (!entries.length) {
    return NONE
  }

  return entries
    .map(([code, amount]) => {
      try {
        return new Intl.NumberFormat(locale, { style: 'currency', currency: code.toUpperCase() }).format(amount)
      } catch {
        return `${amount} ${code.toUpperCase()}`
      }
    })
    .join(', ')
}

export const CAPTURE_MODES: CaptureMode[] = ['manual', 'on_order', 'on_delivery']

export const CAPTURE_MODE_LABELS: Record<CaptureMode, string> = {
  manual: 'Manual',
  on_order: 'On Order',
  on_delivery: 'On Delivery',
}

export const captureModeLabel = (mode: CaptureMode): string => {
  return CAPTURE_MODE_LABELS[mode]
}

export const autoCancelLabel = (s: Pick<ProviderSettings, 'auto_cancel_enabled' | 'auto_cancel_days'>): string => {
  if (!s.auto_cancel_enabled || !s.auto_cancel_days) {
    return 'Off'
  }

  return `After ${s.auto_cancel_days} ${s.auto_cancel_days === 1 ? 'Day' : 'Days'}`
}

/** Medusa's translation editor for the settings row (the route the dashboard's own "Translations" actions open). */
export const translationsUrl = (settingsId: string): string => {
  return `/settings/translations/edit?${new URLSearchParams({ reference: SETTINGS_REFERENCE, reference_id: settingsId })}`
}

/** IBAN in groups of 4, as printed on statements. */
export const formatIban = (iban: string): string => {
  return (
    iban
      .replace(/\s+/g, '')
      .toUpperCase()
      .match(/.{1,4}/g)
      ?.join(' ') ?? ''
  )
}

/** A copy of `list` with the item at `index` moved one step up (-1) or down (1); out of range = unchanged copy. */
export const moveItem = <T>(list: T[], index: number, dir: -1 | 1): T[] => {
  const next = [...list]
  const to = index + dir

  if (index < 0 || index >= list.length || to < 0 || to >= list.length) {
    return next
  }

  ;[next[index], next[to]] = [next[to], next[index]]

  return next
}

// Sentence case, like the values in Medusa's own tables.
export const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  bank_transfer: 'Bank Transfer',
  cash_on_delivery: 'Cash On Delivery',
  invoice: 'Invoice',
  other: 'Other',
}

export const paymentTypeLabel = (type: PaymentType): string => {
  return PAYMENT_TYPE_LABELS[type]
}

/** What a provider type needs: cash on delivery has no bank account, payment reference or QR code. */
export { sectionsForType } from './payment-type'

export const SCHEME_LABELS: Record<ReferenceScheme, string> = { none: 'None', SI00: 'SI00', SI12: 'SI12', RF: 'RF' }
export const QR_TYPE_LABELS: Record<QrType, string> = { none: 'None', epc: 'EPC', upn: 'UPN' }

/** The default account: the one without countries, used where no country-specific account matches. */
export const defaultAccountId = (accounts: BankAccount[]): string | null => {
  return (
    accounts.find((a) => {
      return a.countries.length === 0
    })?.id ?? null
  )
}

/** Whether `account` is (or, when new and there is no default yet, becomes) the default account. */
export const isDefaultAccount = (accounts: BankAccount[], account: BankAccount): boolean => {
  const id = defaultAccountId(accounts)

  return (
    account.id === id ||
    (id === null &&
      !accounts.some((a) => {
        return a.id === account.id
      }))
  )
}

/** Makes `id` the default account in one change: it gives its countries to the previous default. */
export const setDefaultAccount = (accounts: BankAccount[], id: string): BankAccount[] => {
  const target = accounts.find((a) => {
    return a.id === id
  })
  const previous = defaultAccountId(accounts)

  if (!target || previous === id) {
    return [...accounts]
  }

  return accounts.map((a) => {
    if (a.id === id) {
      return { ...a, countries: [] }
    }

    return a.id === previous ? { ...a, countries: target.countries } : a
  })
}

/** The default account can't be deleted while other accounts depend on it. */
export const canDeleteAccount = (accounts: BankAccount[], id: string): boolean => {
  return defaultAccountId(accounts) !== id || accounts.length === 1
}

/** `latest` with only the `keys` a section owns taken from `patch`, so a section never overwrites the others. */
export const mergeSettingsPatch = <K extends keyof ProviderSettings>(
  latest: ProviderSettings,
  patch: Pick<ProviderSettings, K>,
  keys: readonly K[],
): ProviderSettings => {
  const next = { ...latest }

  for (const k of keys) {
    next[k] = patch[k]
  }

  return next
}

// @medusajs/ui's DataTable types onRowClick's row as the row data, but passes the TanStack row ({ id, original }).
// Accept both shapes; the table's getRowId makes `id` the provider id.
export const rowIdOf = (row: unknown): string | null => {
  if (typeof row !== 'object' || row === null) {
    return null
  }

  if ('provider_id' in row && typeof row.provider_id === 'string') {
    return row.provider_id
  }

  if ('id' in row && typeof row.id === 'string') {
    return row.id
  }

  return null
}

const MANUAL_PROVIDER_PREFIX = 'pp_manual_'

/** Admin URLs use the id from medusa-config (`bankTransfer`), not Medusa's provider id (`pp_manual_bankTransfer`). */
export const providerUrlId = (providerId: string): string => {
  return providerId.startsWith(MANUAL_PROVIDER_PREFIX) ? providerId.slice(MANUAL_PROVIDER_PREFIX.length) : providerId
}

export const providerIdFromUrl = (urlId: string): string => {
  return urlId.startsWith(MANUAL_PROVIDER_PREFIX) ? urlId : `${MANUAL_PROVIDER_PREFIX}${urlId}`
}
