import { rejects } from './rules'
import type { CurrencyAmounts, CurrencyRule, ProviderSettings } from './types'

/** The per-currency amounts the admin edits together in the Amounts grid, one row each. */
export const AMOUNT_FIELDS = ['min_total', 'max_total', 'fee'] as const
export type AmountField = (typeof AMOUNT_FIELDS)[number]
export type Amounts = Pick<ProviderSettings, AmountField>

const allows = (rule: CurrencyRule | null, code: string): boolean => {
  return !rule || !rejects(rule.mode, rule.currencies, [code])
}

/**
 * The currencies the Amounts grid shows (one column each): the store's currencies plus any with a saved amount (no longer in the
 * store), limited to the ones the currency rule allows.
 */
export const amountCurrencies = (store: string[], rule: CurrencyRule | null, saved: Amounts): string[] => {
  const savedCodes = AMOUNT_FIELDS.flatMap((f) => {
    return Object.keys(saved[f] ?? {})
  })

  return [...new Set([...store, ...savedCodes])].filter((code) => {
    return allows(rule, code)
  })
}

/** Drops amounts for currencies the currency rule excludes (they can never apply); an emptied map becomes null. */
export const pruneAmounts = (settings: Amounts & Pick<ProviderSettings, 'currencies'>): Amounts => {
  const prune = (map: CurrencyAmounts | null): CurrencyAmounts | null => {
    const kept = Object.entries(map ?? {}).filter(([code]) => {
      return allows(settings.currencies, code)
    })

    return kept.length ? Object.fromEntries(kept) : null
  }

  return { min_total: prune(settings.min_total), max_total: prune(settings.max_total), fee: prune(settings.fee) }
}

/** An amount cell in major units with a "." decimal ("1234.56"): blank is null, unusable text is undefined. */
export const parseAmount = (value: string): number | null | undefined => {
  const text = value.trim()

  if (!text) {
    return null
  }

  return /^\d+(\.\d+)?$/.test(text) ? Number(text) : undefined
}

/** A grid cell: a number as loaded, or text as typed. */
export type AmountCell = string | number | null | undefined

/** The grid's cells (by field, then currency code) as amounts, plus the cells that hold no usable amount. */
export const cellsToAmounts = (
  cells: Record<AmountField, Record<string, AmountCell>>,
  codes: string[],
): { amounts: Amounts; invalid: [AmountField, string][] } => {
  const invalid: [AmountField, string][] = []
  const toMap = (field: AmountField): CurrencyAmounts | null => {
    const entries = codes.flatMap((code): [string, number][] => {
      const cell = cells[field][code]
      const amount = parseAmount(cell === null || cell === undefined ? '' : String(cell))

      if (amount === undefined) {
        invalid.push([field, code])
      }

      return typeof amount === 'number' ? [[code, amount]] : []
    })

    return entries.length ? Object.fromEntries(entries) : null
  }

  return { amounts: { min_total: toMap('min_total'), max_total: toMap('max_total'), fee: toMap('fee') }, invalid }
}
