import assert from 'node:assert/strict'
import { test } from 'node:test'
import { defaultSettings, isValidIban, parseSettings, settingsSchema, validateSettings } from '../../src/lib/settings'
import { isManualProviderId } from '../../src/lib/rules'
import type { BankAccount, ProviderSettings } from '../../src/lib/types'

const acc = (id: string, countries: string[], o: Partial<BankAccount> = {}): BankAccount => {
  return {
    id,
    recipient: 'Acme d.o.o.',
    address_1: null,
    postal_code: null,
    city: null,
    country_code: null,
    iban: 'SI56263300012039086',
    bic: null,
    bank_name: null,
    countries,
    ...o,
  }
}
const s = (o: Partial<ProviderSettings>): ProviderSettings => {
  return { ...defaultSettings('pp_manual_x'), ...o }
}
const has = (errs: string[], re: RegExp) => {
  return errs.some((e) => {
    return re.test(e)
  })
}

test('ids, defaults, iban', () => {
  assert.equal(isManualProviderId('pp_manual_manual'), true)
  assert.equal(isManualProviderId('pp_stripe_x'), false)
  assert.deepEqual(validateSettings(defaultSettings('pp_manual_x')), [])
  assert.equal(defaultSettings('pp_manual_x').enabled, true)
  assert.equal(isValidIban('SI56 2633 0001 2039 086'), true)
  assert.equal(isValidIban('SI56263300012039087'), false)
})

test('schema normalises', () => {
  const { provider_id, ...rest } = defaultSettings('p')
  const out = settingsSchema.parse({
    ...rest,
    currencies: { mode: 'include', currencies: ['EUR'] },
    countries: { mode: 'include', countries: ['SI'] },
    bank_accounts: [acc('a', ['HR'], { iban: 'si56 2633 0001 2039 086' })],
  })

  assert.ok(provider_id)
  assert.deepEqual(out.currencies, { mode: 'include', currencies: ['eur'] })
  assert.deepEqual(out.countries?.countries, ['si'])
  assert.equal(out.bank_accounts[0].iban, 'SI56263300012039086')
  assert.deepEqual(out.bank_accounts[0].countries, ['hr'])
})

test('schema lowercases currency amount keys', () => {
  const { provider_id, ...rest } = defaultSettings('p')
  const out = settingsSchema.parse({ ...rest, fee: { EUR: 1.99 }, min_total: { EUR: 10 }, max_total: { EUR: 300 } })

  assert.ok(provider_id)
  assert.deepEqual(out.fee, { eur: 1.99 })
  assert.deepEqual(out.min_total, { eur: 10 })
  assert.deepEqual(out.max_total, { eur: 300 })
})

test('auto-cancel days must be a whole number of at least 1 (the column is an integer)', () => {
  const { provider_id: _id, ...rest } = defaultSettings('p')
  const parse = (auto_cancel_days: unknown) => {
    return parseSettings('p', { ...rest, auto_cancel_days })
  }
  const invalid = (e: any) => {
    return e.type === 'invalid_data' && /auto_cancel_days/.test(e.message)
  }

  assert.throws(() => parse(3.5), invalid)
  assert.throws(() => parse(0), invalid)
  assert.equal(parse(7).auto_cancel_days, 7)
  assert.equal(parse(null).auto_cancel_days, null)
})

test('rank must be a whole number of at least 0', () => {
  const { provider_id: _id, ...rest } = defaultSettings('p')
  const parse = (rank: unknown) => {
    return parseSettings('p', { ...rest, rank })
  }
  const invalid = (e: any) => {
    return e.type === 'invalid_data' && /rank/.test(e.message)
  }

  assert.equal(defaultSettings('p').rank, 0)
  assert.throws(() => parse(-1), invalid)
  assert.throws(() => parse(1.5), invalid)
  assert.throws(() => parse(undefined), invalid)
  assert.equal(parse(3).rank, 3)
})

test('"only selected countries" needs at least one country; "all except" may be empty', () => {
  const message = 'Select at least one country or choose All Countries'

  assert.deepEqual(validateSettings(s({ countries: { mode: 'include', countries: [] } })), [message])
  assert.deepEqual(validateSettings(s({ countries: { mode: 'include', countries: ['si'] } })), [])
  assert.deepEqual(validateSettings(s({ countries: { mode: 'exclude', countries: [] } })), [])
})

test('"only selected" currencies and shipping options need at least one; "all except" may be empty', () => {
  assert.deepEqual(validateSettings(s({ currencies: { mode: 'include', currencies: [] } })), [
    'Select at least one currency or choose All Currencies',
  ])
  assert.deepEqual(validateSettings(s({ currencies: { mode: 'exclude', currencies: [] } })), [])
  assert.deepEqual(validateSettings(s({ shipping_option_ids: { mode: 'include', shipping_option_ids: [] } })), [
    'Select at least one shipping option or choose All Shipping Options',
  ])
  assert.deepEqual(validateSettings(s({ shipping_option_ids: { mode: 'exclude', shipping_option_ids: [] } })), [])
  assert.deepEqual(validateSettings(s({ shipping_option_ids: { mode: 'include', shipping_option_ids: ['so_1'] } })), [])
})

test('the schema rejects the old list shape and unknown modes', () => {
  const { provider_id, ...rest } = defaultSettings('p')

  assert.ok(provider_id)
  assert.equal(settingsSchema.safeParse({ ...rest, currencies: ['eur'] }).success, false)
  assert.equal(settingsSchema.safeParse({ ...rest, shipping_option_ids: ['so_1'] }).success, false)
  assert.equal(settingsSchema.safeParse({ ...rest, currencies: { mode: 'only', currencies: ['eur'] } }).success, false)
})

test('validateSettings errors', () => {
  assert.ok(has(validateSettings(s({ bank_accounts: [acc('a', []), acc('b', [])] })), /exactly one default/))
  assert.ok(has(validateSettings(s({ bank_accounts: [acc('a', ['hr'])] })), /exactly one default/))
  assert.ok(has(validateSettings(s({ bank_accounts: [acc('a', [], { iban: 'SI00' })] })), /IBAN/))
  assert.ok(has(validateSettings(s({ min_total: { eur: 20 }, max_total: { eur: 10 } })), /Minimum/))
  assert.ok(has(validateSettings(s({ auto_cancel_enabled: true, auto_cancel_days: null })), /Auto-cancel/))
  assert.ok(has(validateSettings(s({ auto_cancel_enabled: true, auto_cancel_days: 0 })), /Auto-cancel/))
  assert.ok(has(validateSettings(s({ reference_scheme: 'SI12', reference_template: 'A{display_id}' })), /digits/))
  assert.ok(
    has(validateSettings(s({ reference_scheme: 'RF', reference_template: 'ORD-{display_id}' })), /RF reference/),
  )
  assert.ok(
    !has(validateSettings(s({ reference_scheme: 'RF', reference_template: 'ORD {display_id}' })), /RF reference/),
  )
  assert.ok(
    has(validateSettings(s({ qr_type: 'epc', bank_accounts: [acc('a', [], { recipient: ' ' })] })), /recipient/),
  )
  assert.ok(has(validateSettings(s({ upn_purpose_code: 'abc' })), /UPN/))
  assert.ok(has(validateSettings(s({ countries: { mode: 'include', countries: ['SI'] } })), /country/))
  assert.ok(has(validateSettings(s({ currencies: { mode: 'exclude', currencies: ['euro'] } })), /currency/))
})

test('valid full settings', () => {
  assert.deepEqual(
    validateSettings(
      s({
        countries: { mode: 'exclude', countries: ['us'] },
        min_total: { eur: 10 },
        max_total: { eur: 300 },
        currencies: { mode: 'include', currencies: ['eur'] },
        shipping_option_ids: { mode: 'exclude', shipping_option_ids: ['so_1'] },
        fee: { eur: 1.5 },
        bank_accounts: [acc('a', []), acc('b', ['hr'])],
        reference_scheme: 'SI12',
        reference_template: '12{display_id}',
        qr_type: 'epc',
        upn_purpose_code: 'OTHR',
        auto_cancel_enabled: true,
        auto_cancel_days: 7,
        enabled: false,
      }),
    ),
    [],
  )
})

test('label: defaults to null, is trimmed, blank becomes null and is capped at 100 characters', () => {
  const { provider_id, ...rest } = defaultSettings('p')

  assert.ok(provider_id)
  assert.equal(defaultSettings('p').label, null)
  assert.equal(settingsSchema.parse({ ...rest, label: '  Wire Transfer ' }).label, 'Wire Transfer')
  assert.equal(settingsSchema.parse({ ...rest, label: '   ' }).label, null)
  assert.equal(settingsSchema.parse({ ...rest, label: null }).label, null)
  assert.equal(settingsSchema.safeParse({ ...rest, label: 'x'.repeat(100) }).success, true)
  assert.equal(settingsSchema.safeParse({ ...rest, label: 'x'.repeat(101) }).success, false)
})

test('description: defaults to null, is trimmed, blank becomes null and is capped at 500 characters', () => {
  const { provider_id, ...rest } = defaultSettings('p')

  assert.ok(provider_id)
  assert.equal(defaultSettings('p').description, null)
  assert.equal(
    settingsSchema.parse({ ...rest, description: '  Transfer to our account ' }).description,
    'Transfer to our account',
  )
  assert.equal(settingsSchema.parse({ ...rest, description: '   ' }).description, null)
  assert.equal(settingsSchema.parse({ ...rest, description: null }).description, null)
  assert.equal(settingsSchema.safeParse({ ...rest, description: 'x'.repeat(500) }).success, true)
  assert.equal(settingsSchema.safeParse({ ...rest, description: 'x'.repeat(501) }).success, false)
})

test('bank account address: trimmed, blank becomes null, country code lowercased and validated', () => {
  const { provider_id, ...rest } = defaultSettings('p')
  const parsed = (o: Partial<BankAccount>) => {
    return settingsSchema.parse({ ...rest, bank_accounts: [acc('a', [], o)] }).bank_accounts[0]
  }
  const out = parsed({ address_1: ' Main 1 ', postal_code: '1000', city: 'Ljubljana', country_code: ' SI ' })

  assert.ok(provider_id)
  assert.equal(out.address_1, 'Main 1')
  assert.equal(out.country_code, 'si')
  assert.deepEqual(
    parsed({ address_1: ' ', postal_code: '', city: '  ', country_code: '' }),
    acc('a', [], { address_1: null, postal_code: null, city: null, country_code: null }),
  )
  assert.deepEqual(validateSettings(s({ bank_accounts: [acc('a', [], { country_code: 'si' })] })), [])
  assert.deepEqual(validateSettings(s({ bank_accounts: [acc('a', [], { country_code: 'svn' })] })), [
    'Invalid country code: svn',
  ])
})
