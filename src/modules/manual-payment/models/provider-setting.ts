import { model } from '@medusajs/framework/utils'
import type { BankAccount, CountryRule, CurrencyAmounts, CurrencyRule, ShippingOptionRule } from '../../../lib/types'

const ManualPaymentProviderSetting = model.define('manual_payment_provider_setting', {
  id: model.id({ prefix: 'mpps' }).primaryKey(),
  provider_id: model.text().unique(),
  // Display name; translatable like the fee label and instructions. The id-derived name is used while empty.
  label: model.text().translatable().nullable(),
  // Short line shown under the payment method at checkout; translatable.
  description: model.text().translatable().nullable(),
  enabled: model.boolean().default(true),
  // Sort order: admin list, store eligibility, listManualProviders (ascending, ties by provider_id).
  rank: model.number().default(0),
  countries: model.json<CountryRule>().nullable(),
  min_total: model.json<CurrencyAmounts>().nullable(),
  max_total: model.json<CurrencyAmounts>().nullable(),
  currencies: model.json<CurrencyRule>().nullable(),
  shipping_option_ids: model.json<ShippingOptionRule>().nullable(),
  capture_mode: model.enum(['manual', 'on_order', 'on_delivery']).default('manual'),
  fee: model.json<CurrencyAmounts>().nullable(),
  // Translatable: Medusa's Translations editor and translation module, referenced by the row id.
  fee_label: model.text().translatable().nullable(),
  instructions: model.text().translatable().nullable(),
  bank_accounts: model.json<BankAccount[]>(),
  reference_template: model.text().nullable(),
  reference_scheme: model.enum(['none', 'SI00', 'SI12', 'RF']).default('none'),
  qr_type: model.enum(['none', 'epc', 'upn']).default('none'),
  upn_purpose_code: model.text().nullable(),
  auto_cancel_enabled: model.boolean().default(false),
  auto_cancel_days: model.number().nullable(),
})

export default ManualPaymentProviderSetting
