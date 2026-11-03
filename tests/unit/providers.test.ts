import assert from 'node:assert/strict'
import { test } from 'node:test'
import { listManualProviders, sortByRank } from '../../src/lib/providers'
import { defaultSettings } from '../../src/lib/settings'
import { createRequest } from './support/routes'

const p = (provider_id: string) => ({ provider_id })

test('sortByRank: rank ascending, ties by provider_id, no settings row counts as 0', () => {
  const providers = [p('pp_manual_c'), p('pp_manual_a'), p('pp_manual_b'), p('pp_manual_d')]
  const sorted = sortByRank(providers, [
    { provider_id: 'pp_manual_a', rank: 2 },
    { provider_id: 'pp_manual_b', rank: 0 },
    { provider_id: 'pp_manual_d', rank: 1 },
  ])

  assert.deepEqual(
    sorted.map((x) => x.provider_id),
    ['pp_manual_b', 'pp_manual_c', 'pp_manual_d', 'pp_manual_a'],
  )
  assert.deepEqual(
    providers.map((x) => x.provider_id),
    ['pp_manual_c', 'pp_manual_a', 'pp_manual_b', 'pp_manual_d'],
  )
  assert.deepEqual(sortByRank([], []), [])
})

test('listManualProviders: registered manual providers sorted by rank; enabled from settings, true without a row', async () => {
  const scope = createRequest(
    {},
    {
      configModule: {
        modules: {
          payment: {
            options: {
              providers: [
                {
                  resolve: '@rokmohar/medusa-payment-manual/providers/manual',
                  id: 'cod',
                  options: { type: 'cash_on_delivery' },
                },
              ],
            },
          },
        },
      },
      payment: {
        listPaymentProviders: async () => [
          { id: 'pp_manual_cod', is_enabled: true },
          { id: 'pp_manual_bank', is_enabled: false },
          { id: 'pp_manual_wire', is_enabled: true },
          { id: 'pp_stripe_stripe', is_enabled: true },
        ],
      },
      manual_payment: {
        listSettings: async () => [
          { ...defaultSettings('pp_manual_bank'), id: 'mpps_bank', rank: 2 },
          { ...defaultSettings('pp_manual_cod'), id: 'mpps_cod', rank: 1, enabled: false },
          { ...defaultSettings('pp_manual_gone'), id: 'mpps_gone', rank: 0 },
        ],
      },
    },
  ).scope as never

  assert.deepEqual(await listManualProviders(scope), [
    { provider_id: 'pp_manual_wire', type: 'other', enabled: true, rank: 0 },
    { provider_id: 'pp_manual_cod', type: 'cash_on_delivery', enabled: false, rank: 1 },
    { provider_id: 'pp_manual_bank', type: 'other', enabled: true, rank: 2 },
  ])
})
