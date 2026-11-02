import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { FeatureFlag } from '@medusajs/framework/utils'
import { GET } from '../../src/api/store/manual-payments/eligibility/route'
import { defaultSettings } from '../../src/lib/settings'
import { createRequest, createResponse, QUERY_KEY } from './support/routes'

const cart = {
  id: 'cart_1',
  region_id: 'reg_1',
  currency_code: 'eur',
  total: 101.99,
  items: [
    { id: 'item_p', variant_id: 'variant_1', unit_price: 100, title: 'Product', total: 100, metadata: null },
    {
      id: 'item_fee',
      variant_id: null,
      unit_price: 1.99,
      title: 'Payment Fee',
      total: 1.99,
      metadata: { manual_payment_fee: 'pp_manual_cod' },
    },
  ],
  shipping_address: { country_code: 'SI' },
  shipping_methods: [{ shipping_option_id: 'so_1' }],
  payment_collection: null,
}
const region = {
  payment_providers: [
    { id: 'pp_manual_bank', is_enabled: true },
    { id: 'pp_manual_cod', is_enabled: true },
    { id: 'pp_manual_old', is_enabled: false },
    { id: 'pp_stripe_stripe', is_enabled: true },
  ],
}
const reg = (carts: unknown[]) => ({
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
  [QUERY_KEY]: {
    graph: async ({ entity }: { entity: string }) => ({
      data: entity === 'cart' ? carts : entity === 'price_preference' ? [] : [region],
    }),
  },
  manual_payment: {
    listSettings: async () => [
      {
        ...defaultSettings('pp_manual_cod'),
        id: 'mpps_cod',
        label: 'Cash On Delivery',
        description: 'Pay the courier',
        fee: { eur: 1.99 },
        max_total: { eur: 100 },
      },
    ],
  },
  translation: {
    listTranslations: async (f: { reference_id: string; locale_code: string }) =>
      f.reference_id === 'mpps_cod' && f.locale_code === 'sl'
        ? [{ translations: { fee_label: 'Provizija', label: 'Plačilo ob prevzemu', description: 'Plačate kurirju' } }]
        : [],
  },
})

test('lists enabled managed providers with rules and fees', async () => {
  const { res, payloads } = createResponse<any>()
  await GET(createRequest({ query: { cart_id: 'cart_1' } } as never, reg([cart])), res as never)
  assert.deepEqual(payloads[0], {
    providers: [
      { provider_id: 'pp_manual_bank', type: 'other', allowed: true, label: null, description: null, fee: null },
      {
        provider_id: 'pp_manual_cod',
        type: 'cash_on_delivery',
        allowed: true,
        label: 'Cash On Delivery',
        description: 'Pay the courier',
        fee: { amount: 1.99, currency_code: 'eur', label: 'Payment Fee' },
      },
    ],
  })
})

test('providers are sorted by rank, then provider_id', async () => {
  const ids = async (ranks: Record<string, number>) => {
    const registrations = {
      ...reg([cart]),
      manual_payment: {
        listSettings: async () =>
          Object.entries(ranks).map(([id, rank]) => ({ ...defaultSettings(id), id: `mpps_${id}`, rank })),
      },
    }
    const { res, payloads } = createResponse<any>()
    await GET(createRequest({ query: { cart_id: 'cart_1' } } as never, registrations), res as never)
    return payloads[0].providers.map((p: { provider_id: string }) => p.provider_id)
  }

  assert.deepEqual(await ids({ pp_manual_cod: 0, pp_manual_bank: 1 }), ['pp_manual_cod', 'pp_manual_bank'])
  assert.deepEqual(await ids({ pp_manual_cod: 1 }), ['pp_manual_bank', 'pp_manual_cod'])
  assert.deepEqual(await ids({}), ['pp_manual_bank', 'pp_manual_cod'])
})

test('total excludes the fee item, so the max rule is checked against 100', async () => {
  const over = { ...cart, total: 101.99, items: [{ ...cart.items[0], total: 100.01 }, cart.items[1]] }
  const { res, payloads } = createResponse<any>()
  await GET(createRequest({ query: { cart_id: 'cart_1' } } as never, reg([{ ...over, total: 102 }])), res as never)
  assert.deepEqual(payloads[0].providers[1], {
    provider_id: 'pp_manual_cod',
    type: 'cash_on_delivery',
    allowed: false,
    reason: 'max_total',
    label: 'Cash On Delivery',
    description: 'Pay the courier',
    fee: { amount: 1.99, currency_code: 'eur', label: 'Payment Fee' },
  })
})

test('400 without cart_id, 404 for unknown cart', async () => {
  const { res } = createResponse()
  await assert.rejects(
    GET(createRequest({ query: {} } as never, reg([cart])), res as never),
    (e: any) => e.type === 'invalid_data',
  )
  await assert.rejects(
    GET(createRequest({ query: { cart_id: 'nope' } } as never, reg([])), res as never),
    (e: any) => e.type === 'not_found',
  )
})

afterEach(() => {
  FeatureFlag.setFlag('translation', false)
})

test('the fee label is translated for the cart locale, else the request locale', async () => {
  FeatureFlag.setFlag('translation', true)
  const label = async (c: unknown, locale?: string) => {
    const { res, payloads } = createResponse<any>()
    await GET(createRequest({ query: { cart_id: 'cart_1' }, locale } as never, reg([c])), res as never)
    return payloads[0].providers[1].fee.label
  }

  assert.equal(await label({ ...cart, locale: 'sl' }, 'en'), 'Provizija')
  assert.equal(await label({ ...cart, locale: null }, 'sl'), 'Provizija')
  assert.equal(await label({ ...cart, locale: 'en' }, 'sl'), 'Payment Fee')
  assert.equal(await label(cart), 'Payment Fee')
})

test('the label is translated for the cart locale, else the request locale, else the stored label; null when unset', async () => {
  FeatureFlag.setFlag('translation', true)
  const label = async (c: unknown, locale?: string) => {
    const { res, payloads } = createResponse<any>()
    await GET(createRequest({ query: { cart_id: 'cart_1' }, locale } as never, reg([c])), res as never)
    return payloads[0].providers.map((p: { label: string | null }) => p.label)
  }

  assert.deepEqual(await label({ ...cart, locale: 'sl' }, 'en'), [null, 'Plačilo ob prevzemu'])
  assert.deepEqual(await label({ ...cart, locale: null }, 'sl'), [null, 'Plačilo ob prevzemu'])
  assert.deepEqual(await label(cart), [null, 'Cash On Delivery'])
})

test('the description is translated for the cart locale, else the request locale, else the stored one; null when unset', async () => {
  FeatureFlag.setFlag('translation', true)
  const description = async (c: unknown, locale?: string) => {
    const { res, payloads } = createResponse<any>()
    await GET(createRequest({ query: { cart_id: 'cart_1' }, locale } as never, reg([c])), res as never)
    return payloads[0].providers.map((p: { description: string | null }) => p.description)
  }

  assert.deepEqual(await description({ ...cart, locale: 'sl' }, 'en'), [null, 'Plačate kurirju'])
  assert.deepEqual(await description({ ...cart, locale: null }, 'sl'), [null, 'Plačate kurirju'])
  assert.deepEqual(await description(cart), [null, 'Pay the courier'])
})
