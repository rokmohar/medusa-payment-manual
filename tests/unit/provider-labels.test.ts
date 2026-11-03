import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { FeatureFlag } from '@medusajs/framework/utils'
import { getProviderLabels } from '../../src/lib/provider-labels'
import { defaultSettings } from '../../src/lib/settings'
import { createRequest } from './support/routes'

const scope = createRequest(
  {},
  {
    manual_payment: {
      listSettings: async () => [
        { ...defaultSettings('pp_manual_bank'), id: 'mpps_bank', label: ' Bank Transfer ' },
        { ...defaultSettings('pp_manual_cod'), id: 'mpps_cod', label: null },
        { ...defaultSettings('pp_manual_other'), id: 'mpps_other', label: '   ' },
      ],
    },
    translation: {
      listTranslations: async (f: { reference_id: string; locale_code: string }) =>
        f.locale_code === 'sl'
          ? [{ translations: { label: f.reference_id === 'mpps_bank' ? 'Bančno nakazilo' : 'Po povzetju' } }]
          : [],
    },
  },
).scope as never

beforeEach(() => {
  FeatureFlag.setFlag('translation', true)
})
afterEach(() => {
  FeatureFlag.setFlag('translation', false)
})

test('one entry per settings row: the trimmed stored label, null when blank or unset', async () => {
  assert.deepEqual(await getProviderLabels(scope), {
    pp_manual_bank: 'Bank Transfer',
    pp_manual_cod: null,
    pp_manual_other: null,
  })
  assert.deepEqual(await getProviderLabels(scope, 'de'), await getProviderLabels(scope))
})

test('labels are translated for the locale', async () => {
  assert.deepEqual(await getProviderLabels(scope, 'sl'), {
    pp_manual_bank: 'Bančno nakazilo',
    pp_manual_cod: 'Po povzetju',
    pp_manual_other: 'Po povzetju',
  })
})
