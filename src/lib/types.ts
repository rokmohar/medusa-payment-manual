// Include or exclude rules; 'all' (or a null rule) matches everything.
export type RuleMode = 'all' | 'include' | 'exclude'
export type CountryRule = { mode: RuleMode; countries: string[] }
export type CurrencyRule = { mode: RuleMode; currencies: string[] }
export type ShippingOptionRule = { mode: RuleMode; shipping_option_ids: string[] }
export type BankAccount = {
  id: string
  recipient: string
  // The recipient's address, with Medusa's address field names.
  address_1: string | null
  postal_code: string | null
  city: string | null
  country_code: string | null // ISO 3166-1 alpha-2, lowercase
  iban: string // stored without spaces, uppercase
  bic: string | null
  bank_name: string | null
  countries: string[] // [] = the default account
}
export type CaptureMode = 'manual' | 'on_order' | 'on_delivery'
export type ReferenceScheme = 'none' | 'SI00' | 'SI12' | 'RF'
export type QrType = 'none' | 'epc' | 'upn'
export type CurrencyAmounts = Record<string, number> // currency_code → amount
export type ProviderSettings = {
  provider_id: string
  label: string | null // admin display name; the id-derived name is used while null
  description: string | null // short line under the payment method at checkout; translatable
  enabled: boolean // false: not offered for new checkouts; existing orders are unaffected
  rank: number // sort order, ascending; ties by provider_id
  countries: CountryRule | null
  min_total: CurrencyAmounts | null
  max_total: CurrencyAmounts | null
  currencies: CurrencyRule | null
  shipping_option_ids: ShippingOptionRule | null
  capture_mode: CaptureMode
  fee: CurrencyAmounts | null
  fee_label: string | null // line item title; default "Payment Fee"; translatable
  instructions: string | null // shown to the customer after the order is placed; translatable
  bank_accounts: BankAccount[] // display order
  reference_template: string | null // placeholder {display_id}
  reference_scheme: ReferenceScheme
  qr_type: QrType
  upn_purpose_code: string | null // 4 uppercase letters, default 'OTHR'
  auto_cancel_enabled: boolean
  auto_cancel_days: number | null
}
/** Settings as stored; translations reference the row `id`, which stays the same across saves. */
export type StoredSettings = ProviderSettings & { id: string }
/** The settings model's translation reference: Medusa's snake_case of the model name. */
export const SETTINGS_REFERENCE = 'manual_payment_provider_setting'
export type RuleReason = 'country' | 'min_total' | 'max_total' | 'currency' | 'shipping_option' | 'disabled'
export type CartContext = {
  currency_code: string
  total: number // excluding plugin fee items
  country_code: string | null // shipping address
  shipping_option_ids: string[]
}
