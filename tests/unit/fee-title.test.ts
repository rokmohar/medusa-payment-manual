import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { FeatureFlag, Modules } from '@medusajs/framework/utils'
import { retitleFeeItems } from '../../src/lib/fee-title'
import { defaultSettings } from '../../src/lib/settings'
import handler, { config } from '../../src/subscribers/fee-title'
import { createRequest, QUERY_KEY } from './support/routes'

const COD = 'pp_manual_cod'
const product = { id: 'item_p', variant_id: 'variant_1', title: 'Shirt', metadata: { manual_payment_fee: COD } }
const fee = (title: string, provider_id = COD) => ({
  id: `fee_${provider_id}`,
  variant_id: null,
  title,
  metadata: { manual_payment_fee: provider_id },
})
const cart = (locale: string | null, items: unknown[]) => ({ id: 'cart_1', locale, items })

const fakeContainer = (state: unknown, update?: () => Promise<void>) => {
  const errors: unknown[][] = []
  const updates: unknown[] = []
  const container = createRequest(
    {},
    {
      logger: { error: (...args: unknown[]) => errors.push(args) },
      [QUERY_KEY]: { graph: async () => ({ data: state ? [state] : [] }) },
      manual_payment: {
        getSettings: async (id: string) =>
          id === COD ? { ...defaultSettings(COD), id: 'mpps_cod', fee: { eur: 1.99 }, fee_label: 'COD Fee' } : null,
      },
      [Modules.TRANSLATION]: {
        listTranslations: async (f: { reference_id: string; locale_code: string }) =>
          f.reference_id === 'mpps_cod' && f.locale_code === 'sl' ? [{ translations: { fee_label: 'Provizija' } }] : [],
      },
      [Modules.CART]: {
        updateLineItems: async (data: unknown) => {
          updates.push(data)
          await update?.()
        },
      },
    },
  ).scope as never

  return { container, errors, updates }
}

beforeEach(() => {
  FeatureFlag.setFlag('translation', true)
})
afterEach(() => {
  FeatureFlag.setFlag('translation', false)
})

test('re-titles fee items for the cart locale; products and up-to-date items are left alone', async () => {
  const toSl = fakeContainer(cart('sl', [product, fee('COD Fee')]))
  await retitleFeeItems(toSl.container, 'cart_1')
  assert.deepEqual(toSl.updates, [[{ id: `fee_${COD}`, title: 'Provizija' }]])

  const toEn = fakeContainer(cart('en', [product, fee('Provizija')]))
  await retitleFeeItems(toEn.container, 'cart_1')
  assert.deepEqual(toEn.updates, [[{ id: `fee_${COD}`, title: 'COD Fee' }]])

  const same = fakeContainer(cart('sl', [product, fee('Provizija')]))
  await retitleFeeItems(same.container, 'cart_1')
  assert.deepEqual(same.updates, [])
})

test('a fee of a provider without settings gets the default title', async () => {
  const { container, updates } = fakeContainer(cart('sl', [fee('Old', 'pp_manual_gone')]))
  await retitleFeeItems(container, 'cart_1')
  assert.deepEqual(updates, [[{ id: 'fee_pp_manual_gone', title: 'Payment Fee' }]])
})

// Like Medusa, which re-translates items only when a locale is set: the fee keeps the title it got from the request.
test('nothing changes for a cart without a locale, a missing cart, or with the translation feature off', async () => {
  const noLocale = fakeContainer(cart(null, [fee('Provizija')]))
  await retitleFeeItems(noLocale.container, 'cart_1')
  assert.deepEqual(noLocale.updates, [])

  const missing = fakeContainer(null)
  await retitleFeeItems(missing.container, 'cart_x')
  assert.deepEqual(missing.updates, [])

  FeatureFlag.setFlag('translation', false)
  const off = fakeContainer(cart('sl', [fee('Provizija')]))
  await retitleFeeItems(off.container, 'cart_1')
  assert.deepEqual(off.updates, [])
})

test('subscriber runs on cart.updated under a plugin-scoped id', async () => {
  assert.equal(config.event, 'cart.updated')
  assert.equal(config.context?.subscriberId, 'manual-payment-fee-title')

  const { container, errors, updates } = fakeContainer(cart('sl', [fee('COD Fee')]))
  await handler({ event: { name: 'cart.updated', data: { id: 'cart_1' } }, container } as never)
  assert.deepEqual(updates, [[{ id: `fee_${COD}`, title: 'Provizija' }]])
  assert.deepEqual(errors, [])
})

test('subscriber logs a failure with the error and never throws', async () => {
  const boom = new Error('boom')
  const { container, errors } = fakeContainer(cart('sl', [fee('COD Fee')]), async () => {
    throw boom
  })

  await handler({ event: { name: 'cart.updated', data: { id: 'cart_1' } }, container } as never)
  await handler({ event: { name: 'cart.updated', data: { nope: 1 } }, container } as never)
  assert.equal(errors.length, 2)
  assert.deepEqual(errors[0], [`manual-payment: re-titling the fee failed on cart.updated {"id":"cart_1"}`, boom])
  assert.ok(errors[1][1] instanceof Error)
})
