import assert from 'node:assert/strict'
import { test } from 'node:test'
import { defaultSettings } from '../../src/lib/settings'
import { PAYMENT_TYPES } from '../../src/lib/payment-type'
import type { BankAccount } from '../../src/lib/types'
import {
  CAPTURE_MODES,
  autoCancelLabel,
  canDeleteAccount,
  defaultAccountId,
  isDefaultAccount,
  mergeSettingsPatch,
  rowIdOf,
  providerIdFromUrl,
  providerUrlId,
  setDefaultAccount,
  captureModeLabel,
  formatAmounts,
  formatIban,
  translationsUrl,
  moveItem,
  providerDisplayName,
  providerLabel,
  summarizeRule,
  paymentTypeLabel,
  sectionsForType,
} from '../../src/lib/admin-format'

test('providerDisplayName: strips pp_manual_ and title-cases camel, kebab and snake case', () => {
  assert.equal(providerDisplayName('pp_manual_cashOnDelivery'), 'Cash On Delivery')
  assert.equal(providerDisplayName('pp_manual_manual'), 'Manual')
  assert.equal(providerDisplayName('pp_manual_bank-transfer'), 'Bank Transfer')
  assert.equal(providerDisplayName('pp_manual_bank_transfer'), 'Bank Transfer')
  assert.equal(providerDisplayName('pp_manual_UPNPayment'), 'UPN Payment')
  assert.equal(providerDisplayName('pp_manual_'), 'pp_manual_')
  assert.equal(providerDisplayName('other'), 'Other')
})

test('summarizeRule: all, only, all except, truncated after 3', () => {
  assert.equal(summarizeRule(undefined, []), 'All')
  assert.equal(summarizeRule('all', ['si']), 'All')
  assert.equal(summarizeRule('include', ['si', 'hr']), 'Only SI, HR')
  assert.equal(summarizeRule('exclude', ['si']), 'All Except SI')
  assert.equal(summarizeRule('exclude', []), 'All')
  assert.equal(summarizeRule('include', []), 'None')
  assert.equal(summarizeRule('include', ['si', 'hr', 'at', 'de', 'it']), 'Only SI, HR, AT +2')
  assert.equal(summarizeRule('include', ['si', 'hr', 'at']), 'Only SI, HR, AT')
  assert.equal(summarizeRule('exclude', ['eur', 'usd']), 'All Except EUR, USD')
})

test('summarizeRule: shipping options by name, falling back to the id', () => {
  const names: Record<string, string> = { so_1: 'Standard', so_2: 'Express' }
  const name = (id: string) => {
    return names[id] ?? id
  }

  assert.equal(summarizeRule('include', ['so_1', 'so_gone'], name), 'Only Standard, so_gone')
  assert.equal(summarizeRule('exclude', ['so_2'], name), 'All Except Express')
  assert.equal(summarizeRule('include', ['so_1', 'so_2', 'so_1', 'so_2'], name), 'Only Standard, Express, Standard +1')
})

test('formatAmounts: currency style per code, joined; dash when none', () => {
  assert.equal(formatAmounts(null), '–')
  assert.equal(formatAmounts({}), '–')
  assert.equal(formatAmounts({ eur: 1.5 }, 'en-US'), '€1.50')
  assert.equal(formatAmounts({ eur: 2, usd: 3 }, 'en-US'), '€2.00, $3.00')
  assert.equal(formatAmounts({ jpy: 100 }, 'en-US'), '¥100')
  // not an ISO currency code: no throw, plain fallback
  assert.equal(formatAmounts({ e1: 4 }, 'en-US'), '4 E1')
})

test('captureModeLabel', () => {
  assert.equal(captureModeLabel('manual'), 'Manual')
  assert.equal(captureModeLabel('on_order'), 'On Order')
  assert.equal(captureModeLabel('on_delivery'), 'On Delivery')
})

test('autoCancelLabel', () => {
  assert.equal(autoCancelLabel({ auto_cancel_enabled: false, auto_cancel_days: 7 }), 'Off')
  assert.equal(autoCancelLabel({ auto_cancel_enabled: true, auto_cancel_days: 7 }), 'After 7 Days')
  assert.equal(autoCancelLabel({ auto_cancel_enabled: true, auto_cancel_days: 1 }), 'After 1 Day')
  assert.equal(autoCancelLabel({ auto_cancel_enabled: true, auto_cancel_days: null }), 'Off')
})

test("translationsUrl opens Medusa's translation editor for the settings row", () => {
  assert.equal(
    translationsUrl('mpps_01'),
    '/settings/translations/edit?reference=manual_payment_provider_setting&reference_id=mpps_01',
  )
  assert.equal(
    translationsUrl('a&b'),
    '/settings/translations/edit?reference=manual_payment_provider_setting&reference_id=a%26b',
  )
})

test('formatIban: groups of 4, uppercase, spaces normalised', () => {
  assert.equal(formatIban('si56192001234567892'), 'SI56 1920 0123 4567 892')
  assert.equal(formatIban('SI56 1920 0123 4567 892'), 'SI56 1920 0123 4567 892')
  assert.equal(formatIban(''), '')
})

test('moveItem: returns a new array; out-of-range moves are no-ops', () => {
  const list = ['a', 'b', 'c']

  assert.deepEqual(moveItem(list, 1, -1), ['b', 'a', 'c'])
  assert.deepEqual(moveItem(list, 1, 1), ['a', 'c', 'b'])
  assert.deepEqual(moveItem(list, 0, -1), ['a', 'b', 'c'])
  assert.deepEqual(moveItem(list, 2, 1), ['a', 'b', 'c'])
  assert.deepEqual(list, ['a', 'b', 'c'])
  assert.notEqual(moveItem(list, 0, -1), list)
})

const account = (id: string, countries: string[]): BankAccount => {
  return {
    id,
    recipient: id,
    address_1: null,
    postal_code: null,
    city: null,
    country_code: null,
    iban: 'SI56',
    bic: null,
    bank_name: null,
    countries,
  }
}

test('defaultAccountId / isDefaultAccount: the account without countries; a new account is default when none is', () => {
  const list = [account('a', ['si']), account('b', [])]

  assert.equal(defaultAccountId(list), 'b')
  assert.equal(defaultAccountId([account('a', ['si'])]), null)
  assert.equal(isDefaultAccount(list, list[1]), true)
  assert.equal(isDefaultAccount(list, list[0]), false)
  assert.equal(isDefaultAccount(list, account('new', [])), false)
  assert.equal(isDefaultAccount([], account('new', [])), true)
})

test('setDefaultAccount: swaps countries with the old default in one list', () => {
  const list = [account('a', ['si', 'hr']), account('b', []), account('c', ['at'])]

  assert.deepEqual(setDefaultAccount(list, 'a'), [account('a', []), account('b', ['si', 'hr']), account('c', ['at'])])
  assert.deepEqual(setDefaultAccount(list, 'b'), list)
  assert.deepEqual(setDefaultAccount(list, 'missing'), list)
  assert.deepEqual(setDefaultAccount([account('a', ['si'])], 'a'), [account('a', [])])
  assert.deepEqual(list[0].countries, ['si', 'hr'])
})

test('canDeleteAccount: the default account only when it is the last one', () => {
  const list = [account('a', ['si']), account('b', [])]

  assert.equal(canDeleteAccount(list, 'a'), true)
  assert.equal(canDeleteAccount(list, 'b'), false)
  assert.equal(canDeleteAccount([account('b', [])], 'b'), true)
})

test('mergeSettingsPatch: only the owned keys are taken from the patch', () => {
  const latest = { ...defaultSettings('pp_manual_x'), capture_mode: 'on_order' as const, fee_label: 'Old' }
  const stale = {
    ...defaultSettings('pp_manual_x'),
    fee_label: 'New',
    currencies: { mode: 'include' as const, currencies: ['eur'] },
  }
  const merged = mergeSettingsPatch(latest, stale, ['fee_label', 'currencies'])

  assert.equal(merged.fee_label, 'New')
  assert.deepEqual(merged.currencies, { mode: 'include', currencies: ['eur'] })
  assert.equal(merged.capture_mode, 'on_order') // not owned: latest wins
  assert.equal(latest.fee_label, 'Old')
})

test('CAPTURE_MODES lists every labelled mode', () => {
  assert.deepEqual(CAPTURE_MODES, ['manual', 'on_order', 'on_delivery'])
})

test('rowIdOf reads the id DataTable passes to onRowClick', () => {
  // @medusajs/ui types the argument as the row data, but passes the TanStack row at runtime.
  assert.equal(
    rowIdOf({ id: 'pp_manual_bankTransfer', original: { provider_id: 'pp_manual_bankTransfer' } }),
    'pp_manual_bankTransfer',
  )
  assert.equal(rowIdOf({ provider_id: 'pp_manual_cashOnDelivery' }), 'pp_manual_cashOnDelivery')
  assert.equal(rowIdOf({}), null)
  assert.equal(rowIdOf(null), null)
  assert.equal(rowIdOf({ id: 42 }), null)
})

test('paymentTypeLabel gives a Title Case label per type', () => {
  assert.deepEqual(PAYMENT_TYPES.map(paymentTypeLabel), ['Bank Transfer', 'Cash On Delivery', 'Invoice', 'Other'])
})

test('sectionsForType hides bank accounts and reference/QR for cash on delivery only', () => {
  assert.deepEqual(sectionsForType('cash_on_delivery'), { bankAccounts: false, referenceAndQr: false })
  for (const t of ['bank_transfer', 'invoice', 'other'] as const) {
    assert.deepEqual(sectionsForType(t), { bankAccounts: true, referenceAndQr: true })
  }
})

test('admin URLs use the id without the pp_manual_ prefix', () => {
  assert.equal(providerUrlId('pp_manual_bankTransfer'), 'bankTransfer')
  assert.equal(providerUrlId('bankTransfer'), 'bankTransfer')
  assert.equal(providerIdFromUrl('bankTransfer'), 'pp_manual_bankTransfer')
  // Links with the full id keep working.
  assert.equal(providerIdFromUrl('pp_manual_bankTransfer'), 'pp_manual_bankTransfer')
})

test('providerLabel: the stored label, else the id-derived name', () => {
  assert.equal(providerLabel('pp_manual_bank-transfer', 'Wire Transfer'), 'Wire Transfer')
  assert.equal(providerLabel('pp_manual_bank-transfer', null), 'Bank Transfer')
  assert.equal(providerLabel('pp_manual_bank-transfer', undefined), 'Bank Transfer')
  assert.equal(providerLabel('pp_manual_bank-transfer', '  '), 'Bank Transfer')
})
