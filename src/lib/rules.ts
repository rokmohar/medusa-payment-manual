import type { CartContext, ProviderSettings, RuleMode, RuleReason } from './types'

// Whether an include/exclude rule rejects the cart's `values`: include needs one of them listed, exclude none.
export const rejects = (mode: RuleMode, list: string[], values: string[]): boolean => {
  const listed = values.some((v) => {
    return list.includes(v)
  })

  return (mode === 'include' && !listed) || (mode === 'exclude' && listed)
}

export const isManualProviderId = (id: string): boolean => {
  return id.startsWith('pp_manual_')
}

export const evaluateRules = (
  s: ProviderSettings | null,
  cart: CartContext,
): { allowed: true } | { allowed: false; reason: RuleReason } => {
  if (!s) {
    return { allowed: true }
  }

  if (!s.enabled) {
    return { allowed: false, reason: 'disabled' }
  }

  const deny = (reason: RuleReason) => {
    return { allowed: false as const, reason }
  }
  const { countries, currencies, min_total, max_total, shipping_option_ids } = s
  const currency = cart.currency_code.toLowerCase()

  if (countries && countries.mode !== 'all') {
    // Without a shipping address the country can't be checked, so neither mode allows it.
    if (cart.country_code === null || rejects(countries.mode, countries.countries, [cart.country_code.toLowerCase()])) {
      return deny('country')
    }
  }

  if (currencies && rejects(currencies.mode, currencies.currencies, [currency])) {
    return deny('currency')
  }

  const min = min_total?.[currency]

  if (min !== undefined && cart.total < min) {
    return deny('min_total')
  }

  const max = max_total?.[currency]

  if (max !== undefined && cart.total > max) {
    return deny('max_total')
  }

  // Before a shipping method is chosen, include denies (none of the listed is chosen) and exclude allows.
  if (
    shipping_option_ids &&
    rejects(shipping_option_ids.mode, shipping_option_ids.shipping_option_ids, cart.shipping_option_ids)
  ) {
    return deny('shipping_option')
  }

  return { allowed: true }
}
