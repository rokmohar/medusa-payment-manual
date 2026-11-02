import { MedusaError } from '@medusajs/framework/utils'
import { z } from 'zod'
import { formatIssues } from './parse'
import type { ProviderSettings } from './types'

export { isManualProviderId } from './rules'

export const defaultSettings = (provider_id: string): ProviderSettings => {
  return {
    provider_id,
    label: null,
    description: null,
    enabled: true,
    rank: 0,
    countries: null,
    min_total: null,
    max_total: null,
    currencies: null,
    shipping_option_ids: null,
    capture_mode: 'manual',
    fee: null,
    fee_label: null,
    instructions: null,
    bank_accounts: [],
    reference_template: null,
    reference_scheme: 'none',
    qr_type: 'none',
    upn_purpose_code: null,
    auto_cancel_enabled: false,
    auto_cancel_days: null,
  }
}

export const isValidIban = (iban: string): boolean => {
  const s = iban.replace(/\s+/g, '').toUpperCase()

  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(s)) {
    return false
  }

  const digits = (s.slice(4) + s.slice(0, 4)).replace(/[A-Z]/g, (ch) => {
    return String(ch.charCodeAt(0) - 55)
  })
  let rem = 0

  for (const d of digits) {
    rem = (rem * 10 + Number(d)) % 97
  }

  return rem === 1
}

const lower = z.string().transform((v) => {
  return v.trim().toLowerCase()
})
const amounts = z.record(lower, z.number().nonnegative()).nullable()
const nullableStr = z.string().nullable()
// Trimmed; blank becomes null.
const blankToNull = z
  .string()
  .trim()
  .transform((v) => {
    return v || null
  })
  .nullable()

export const bankAccountSchema = z.object({
  id: z.string(),
  recipient: z.string(),
  address_1: blankToNull,
  postal_code: blankToNull,
  city: blankToNull,
  country_code: blankToNull.transform((v) => {
    return v?.toLowerCase() ?? null
  }),
  iban: z.string().transform((v) => {
    return v.replace(/\s+/g, '').toUpperCase()
  }),
  bic: nullableStr,
  bank_name: nullableStr,
  countries: z.array(lower),
})

// Trimmed; blank becomes null.
const optionalText = (max: number) => {
  return z
    .string()
    .trim()
    .max(max)
    .transform((v) => {
      return v || null
    })
    .nullable()
}

const ruleMode = z.enum(['all', 'include', 'exclude'])

export const settingsSchema = z.object({
  label: optionalText(100),
  description: optionalText(500),
  enabled: z.boolean(),
  rank: z.number().int().min(0),
  countries: z.object({ mode: ruleMode, countries: z.array(lower) }).nullable(),
  min_total: amounts,
  max_total: amounts,
  currencies: z.object({ mode: ruleMode, currencies: z.array(lower) }).nullable(),
  shipping_option_ids: z.object({ mode: ruleMode, shipping_option_ids: z.array(z.string()) }).nullable(),
  capture_mode: z.enum(['manual', 'on_order', 'on_delivery']),
  fee: amounts,
  fee_label: nullableStr,
  instructions: nullableStr,
  bank_accounts: z.array(bankAccountSchema),
  reference_template: nullableStr,
  reference_scheme: z.enum(['none', 'SI00', 'SI12', 'RF']),
  qr_type: z.enum(['none', 'epc', 'upn']),
  upn_purpose_code: nullableStr,
  auto_cancel_enabled: z.boolean(),
  auto_cancel_days: z.number().int().min(1).nullable(),
})

export const providerSettingRowSchema = settingsSchema.extend({ id: z.string(), provider_id: z.string() })

// Boundary parse of untrusted input (request body, service callers): normalises and rejects bad shapes as INVALID_DATA.
export const parseSettings = (provider_id: string, input: unknown): ProviderSettings => {
  const result = settingsSchema.safeParse(input)

  if (!result.success) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, formatIssues(result.error))
  }

  return { ...result.data, provider_id }
}

export const validateSettings = (s: ProviderSettings): string[] => {
  const errors: string[] = []
  const cc = (list: string[] | undefined | null, re: RegExp, label: string) => {
    for (const c of list ?? []) {
      if (!re.test(c)) {
        errors.push(`Invalid ${label} code: ${c}`)
      }
    }
  }

  cc(s.countries?.countries, /^[a-z]{2}$/, 'country')
  s.bank_accounts.forEach((a) => {
    cc(a.countries, /^[a-z]{2}$/, 'country')
    cc(a.country_code ? [a.country_code] : null, /^[a-z]{2}$/, 'country')
  })
  cc(s.currencies?.currencies, /^[a-z]{3}$/, 'currency')

  // An empty include list would block every cart without saying why.
  if (s.countries?.mode === 'include' && !s.countries.countries.length) {
    errors.push('Select at least one country or choose All Countries')
  }

  if (s.currencies?.mode === 'include' && !s.currencies.currencies.length) {
    errors.push('Select at least one currency or choose All Currencies')
  }

  if (s.shipping_option_ids?.mode === 'include' && !s.shipping_option_ids.shipping_option_ids.length) {
    errors.push('Select at least one shipping option or choose All Shipping Options')
  }

  for (const m of [s.min_total, s.max_total, s.fee]) {
    cc(m ? Object.keys(m) : null, /^[a-z]{3}$/, 'currency')
  }

  for (const [cur, min] of Object.entries(s.min_total ?? {})) {
    const max = s.max_total?.[cur]

    if (max !== undefined && min > max) {
      errors.push(`Minimum total exceeds maximum total for ${cur}`)
    }
  }

  if (
    s.bank_accounts.length &&
    s.bank_accounts.filter((a) => {
      return a.countries.length === 0
    }).length !== 1
  ) {
    errors.push('There must be exactly one default account (an account with no countries)')
  }

  for (const a of s.bank_accounts) {
    if (!isValidIban(a.iban)) {
      errors.push(`Invalid IBAN: ${a.iban}`)
    }

    if (s.qr_type === 'epc' && !a.recipient.trim()) {
      errors.push(`Account ${a.id} needs a recipient for EPC QR codes`)
    }
  }

  if (s.auto_cancel_enabled && (!s.auto_cancel_days || s.auto_cancel_days <= 0)) {
    errors.push('Auto-cancel requires a number of days greater than 0')
  }

  if (
    s.reference_scheme === 'SI12' &&
    s.reference_template !== null &&
    !/^\d*\{display_id\}\d*$/.test(s.reference_template)
  ) {
    errors.push('SI12 reference template may contain digits only')
  }

  if (
    s.reference_scheme === 'RF' &&
    s.reference_template !== null &&
    !/^[A-Za-z0-9 ]*$/.test(s.reference_template.replaceAll('{display_id}', ''))
  ) {
    errors.push('RF reference template may contain letters, digits and spaces only')
  }

  if (s.upn_purpose_code !== null && !/^[A-Z]{4}$/.test(s.upn_purpose_code)) {
    errors.push('UPN purpose code must be 4 uppercase letters')
  }

  return errors
}
