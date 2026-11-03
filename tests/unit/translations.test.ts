import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { FeatureFlag } from '@medusajs/framework/utils'
import { translateSettings } from '../../src/lib/translations'
import { createRequest } from './support/routes'

const settings = {
  id: 'mpps_1',
  label: 'Bank Transfer',
  description: 'Transfer to our account',
  fee_label: 'Payment Fee',
  instructions: 'Pay on delivery',
}

// A fake translation module: rows keyed by reference + reference_id + locale_code, like the real unique index.
const container = (rows: { reference: string; reference_id: string; locale_code: string; translations: unknown }[]) => {
  const calls: unknown[] = []
  const translation = {
    listTranslations: async (filters: { reference: string; reference_id: string; locale_code: string }) => {
      calls.push(filters)
      return rows.filter((r) => {
        return (
          r.reference === filters.reference &&
          r.reference_id === filters.reference_id &&
          r.locale_code === filters.locale_code
        )
      })
    },
  }

  return { scope: createRequest({}, { translation }).scope, calls }
}

const sl = { reference: 'manual_payment_provider_setting', reference_id: 'mpps_1', locale_code: 'sl' }

beforeEach(() => {
  FeatureFlag.setFlag('translation', true)
})
afterEach(() => {
  FeatureFlag.setFlag('translation', false)
})

test('returns the translated fields for the exact normalized locale', async () => {
  const { scope, calls } = container([
    {
      ...sl,
      translations: {
        label: 'Plačilo po povzetju',
        description: 'Nakazilo na naš račun',
        fee_label: 'Provizija',
        instructions: 'Plačate ob prevzemu',
      },
    },
  ])

  assert.deepEqual(await translateSettings(scope as never, settings, 'SL'), {
    label: 'Plačilo po povzetju',
    description: 'Nakazilo na naš račun',
    fee_label: 'Provizija',
    instructions: 'Plačate ob prevzemu',
  })
  assert.deepEqual(calls, [sl])
})

test('a blank or missing translated field falls back to the base value', async () => {
  const { scope } = container([{ ...sl, translations: { fee_label: '  ', other: 'x' } }])

  assert.deepEqual(await translateSettings(scope as never, settings, 'sl'), {
    label: 'Bank Transfer',
    description: 'Transfer to our account',
    fee_label: 'Payment Fee',
    instructions: 'Pay on delivery',
  })
})

test('translates a field whose base value is empty', async () => {
  const { scope } = container([{ ...sl, translations: { fee_label: 'Provizija' } }])

  assert.deepEqual(await translateSettings(scope as never, { ...settings, fee_label: null }, 'sl'), {
    label: 'Bank Transfer',
    description: 'Transfer to our account',
    fee_label: 'Provizija',
    instructions: 'Pay on delivery',
  })
})

test('matches the exact locale only, like Medusa: sl-SI does not use the sl translation', async () => {
  const { scope, calls } = container([{ ...sl, translations: { fee_label: 'Provizija' } }])

  assert.equal((await translateSettings(scope as never, settings, 'sl-si')).fee_label, 'Payment Fee')
  assert.deepEqual(calls, [{ ...sl, locale_code: 'sl-SI' }])
})

test('base values without a locale, a settings row, or the translation feature; the module is not resolved', async () => {
  const base = {
    label: 'Bank Transfer',
    description: 'Transfer to our account',
    fee_label: 'Payment Fee',
    instructions: 'Pay on delivery',
  }
  const scope = createRequest({}, {}).scope as never

  assert.deepEqual(await translateSettings(scope, settings, null), base)
  assert.deepEqual(await translateSettings(scope, settings, undefined), base)
  assert.deepEqual(await translateSettings(scope, { ...settings, id: undefined }, 'sl'), base)
  assert.deepEqual(await translateSettings(scope, null, 'sl'), {
    label: null,
    description: null,
    fee_label: null,
    instructions: null,
  })

  FeatureFlag.setFlag('translation', false)
  assert.deepEqual(await translateSettings(scope, settings, 'sl'), base)
})

// The module is only registered with the flag on; a config that sets the flag but leaves the module out must not break
// payment sessions or order pages.
test('base values when the translation module is not registered', async () => {
  const scope = createRequest({}, {}).scope as never

  assert.deepEqual(await translateSettings(scope, settings, 'sl'), {
    label: 'Bank Transfer',
    description: 'Transfer to our account',
    fee_label: 'Payment Fee',
    instructions: 'Pay on delivery',
  })
})

test('translates the label, and a null base label stays null without a translation', async () => {
  const { scope } = container([{ ...sl, translations: { label: 'Bančno nakazilo' } }])

  assert.equal((await translateSettings(scope as never, settings, 'sl')).label, 'Bančno nakazilo')
  assert.equal((await translateSettings(scope as never, { ...settings, label: null }, 'de')).label, null)
})

test('translates the description, and a null base description stays null without a translation', async () => {
  const { scope } = container([{ ...sl, translations: { description: 'Nakazilo na naš račun' } }])

  assert.equal((await translateSettings(scope as never, settings, 'sl')).description, 'Nakazilo na naš račun')
  assert.equal((await translateSettings(scope as never, { ...settings, description: null }, 'de')).description, null)
})
