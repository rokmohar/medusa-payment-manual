import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { FeatureFlag } from '@medusajs/framework/utils'
import middlewares, { guardCartCompletion, guardPaymentSession } from '../../src/api/middlewares'
import { defaultSettings } from '../../src/lib/settings'
import type { ProviderSettings } from '../../src/lib/types'
import { createRequest, createResponse, QUERY_KEY } from './support/routes'

const COD = 'pp_manual_cod'
const baseCart = {
  id: 'cart_1',
  region_id: 'reg_1',
  currency_code: 'eur',
  total: 50,
  items: [{ id: 'item_p', variant_id: 'variant_1', unit_price: 50, title: 'Product', total: 50, metadata: null }],
  shipping_address: { country_code: 'si' },
  shipping_methods: [{ shipping_option_id: 'so_1' }],
  payment_collection: { payment_sessions: [] as { provider_id: string; status: string }[] },
}
const codFeeItem = {
  id: 'item_fee',
  variant_id: null,
  unit_price: 1.99,
  title: 'Payment Fee',
  total: 1.99,
  metadata: { manual_payment_fee: COD },
}

const setup = (cart: unknown, settings: Record<string, ProviderSettings>, preferences: unknown[] = []) => {
  const log: unknown[] = []
  const flow = (name: string) => () => ({
    run: async ({ input }: { input: unknown }) => {
      log.push([name, input])
    },
  })
  const flows = { addToCartWorkflow: flow('add'), deleteLineItemsWorkflow: flow('delete') }
  const registrations = {
    [QUERY_KEY]: {
      graph: async ({ entity }: { entity: string }) => ({
        data:
          entity === 'payment_collection'
            ? [{ cart: { id: 'cart_1' } }]
            : entity === 'price_preference'
              ? preferences
              : [cart],
      }),
    },
    manual_payment: { getSettings: async (id: string) => settings[id] ?? null },
    translation: {
      listTranslations: async (f: { reference: string; reference_id: string; locale_code: string }) =>
        f.reference === 'manual_payment_provider_setting' && f.reference_id === 'mpps_cod' && f.locale_code === 'sl'
          ? [{ translations: { fee_label: 'Provizija' } }]
          : [],
    },
  }
  const next = () => {
    log.push('next')
  }

  return { log, flows, registrations, next }
}

const postSession = async (
  provider_id: string,
  cart: unknown,
  settings: Record<string, ProviderSettings>,
  preferences: unknown[] = [],
) => {
  const { log, flows, registrations, next } = setup(cart, settings, preferences)
  const req = createRequest({ params: { id: 'paycol_1' }, body: { provider_id } } as never, registrations)
  await guardPaymentSession(flows as never)(req, createResponse().res, next)

  return log
}

test('registers both guards on the store routes and the rank body validator', () => {
  const routes = (middlewares.routes ?? []).map((r) => [r.methods, r.matcher])
  assert.deepEqual(routes, [
    [['POST'], '/store/payment-collections/:id/payment-sessions'],
    [['POST'], '/store/carts/:id/complete'],
    [['POST'], '/admin/manual-payments/rank'],
  ])
})

test('rank body: provider_ids must be a string array', async () => {
  const validate = middlewares.routes?.find((r) => r.matcher === '/admin/manual-payments/rank')?.middlewares?.[0] as any
  const run = async (body: unknown) => {
    const req: any = { body }
    let error: unknown
    await validate(req, createResponse().res, (e?: unknown) => {
      error = e
    })
    return { req, error }
  }

  const ok = await run({ provider_ids: ['pp_manual_cod'] })
  assert.equal(ok.error, undefined)
  assert.deepEqual(ok.req.validatedBody, { provider_ids: ['pp_manual_cod'] })
  for (const body of [{}, { provider_ids: 'pp_manual_cod' }, { provider_ids: [1] }]) {
    assert.equal(((await run(body)).error as any)?.type, 'invalid_data')
  }
})

test('disallowed provider → 400 with the reason, no workflows, no next', async () => {
  const settings = { [COD]: { ...defaultSettings(COD), fee: { eur: 1.99 }, max_total: { eur: 10 } } }
  const { log, flows, registrations, next } = setup(baseCart, settings)
  const req = createRequest({ params: { id: 'paycol_1' }, body: { provider_id: COD } } as never, registrations)
  await assert.rejects(guardPaymentSession(flows as never)(req, createResponse().res, next), (e: any) => {
    return e.type === 'invalid_data' && e.message === 'manual_payment_not_allowed:max_total'
  })
  assert.deepEqual(log, [])
})

test('allowed provider with a fee → add workflow then next', async () => {
  const settings = { [COD]: { ...defaultSettings(COD), fee: { eur: 1.99 } } }
  assert.deepEqual(await postSession(COD, baseCart, settings), [
    [
      'add',
      {
        cart_id: 'cart_1',
        items: [
          {
            title: 'Payment Fee',
            unit_price: 1.99,
            quantity: 1,
            requires_shipping: false,
            is_discountable: false,
            is_tax_inclusive: false,
            metadata: { manual_payment_fee: COD },
          },
        ],
      },
    ],
    'next',
  ])
})

// Mirrors the pricing module for a plain per-currency price: only the currency_code preference counts; none → exclusive.
test('the fee item follows the price preference of the cart currency, never the region', async () => {
  const settings = { [COD]: { ...defaultSettings(COD), fee: { eur: 1.99 } } }
  const pref = (attribute: string, value: string, is_tax_inclusive: boolean) => ({ attribute, value, is_tax_inclusive })
  const taxInclusive = async (preferences: unknown[]) => {
    const [[, input]] = (await postSession(COD, baseCart, settings, preferences)) as [string, any][]

    return input.items[0].is_tax_inclusive
  }

  assert.equal(await taxInclusive([pref('currency_code', 'eur', true)]), true)
  assert.equal(await taxInclusive([pref('region_id', 'reg_1', true), pref('currency_code', 'eur', false)]), false)
  assert.equal(await taxInclusive([pref('region_id', 'reg_1', true)]), false)
  assert.equal(await taxInclusive([pref('currency_code', 'usd', true)]), false)
  assert.equal(await taxInclusive([]), false)
})

test('switching between managed providers removes before adding', async () => {
  const BANK = 'pp_manual_bank'
  const cart = { ...baseCart, items: [...baseCart.items, codFeeItem] }
  const settings = { [BANK]: { ...defaultSettings(BANK), fee: { eur: 0.5 }, fee_label: 'Bank fee' } }
  const log = await postSession(BANK, cart, settings)
  assert.deepEqual(
    log.map((l) => (Array.isArray(l) ? l[0] : l)),
    ['delete', 'add', 'next'],
  )
  assert.deepEqual(log[0], ['delete', { cart_id: 'cart_1', ids: ['item_fee'] }])
})

test('fee item total does not count toward the rules (exact decimals)', async () => {
  const cart = {
    ...baseCart,
    total: 0.3,
    items: [
      { ...baseCart.items[0], unit_price: 0.1, total: 0.1 },
      { ...codFeeItem, unit_price: 0.1, total: 0.1 },
    ],
  }
  const settings = { [COD]: { ...defaultSettings(COD), fee: { eur: 0.1 }, min_total: { eur: 0.2 } } }
  assert.deepEqual(await postSession(COD, cart, settings), ['next'])
})

test('non-manual provider → only removal of stale fee items', async () => {
  const cart = { ...baseCart, items: [...baseCart.items, codFeeItem] }
  assert.deepEqual(await postSession('pp_stripe_stripe', cart, {}), [
    ['delete', { cart_id: 'cart_1', ids: ['item_fee'] }],
    'next',
  ])
  assert.deepEqual(await postSession('pp_stripe_stripe', baseCart, {}), ['next'])
})

test('managed provider without settings is a no-op', async () => {
  assert.deepEqual(await postSession(COD, baseCart, {}), ['next'])
})

test('malformed body and collection without a cart pass through', async () => {
  const { log, flows, registrations, next } = setup(baseCart, {})
  const req = createRequest({ params: { id: 'paycol_1' }, body: {} } as never, registrations)
  await guardPaymentSession(flows as never)(req, createResponse().res, next)
  assert.deepEqual(log, ['next'])

  const orphan = setup(baseCart, {})
  orphan.registrations[QUERY_KEY] = { graph: async () => ({ data: [{ cart: null }] }) }
  const req2 = createRequest({ params: { id: 'paycol_1' }, body: { provider_id: COD } } as never, orphan.registrations)
  await guardPaymentSession(orphan.flows as never)(req2, createResponse().res, orphan.next)
  assert.deepEqual(orphan.log, ['next'])
})

const complete = async (cart: unknown, settings: Record<string, ProviderSettings>) => {
  const { log, flows, registrations, next } = setup(cart, settings)
  const req = createRequest({ params: { id: 'cart_1' } } as never, registrations)
  await guardCartCompletion(flows as never)(req, createResponse().res, next)

  return log
}

test('cart complete with a session whose provider is now disallowed → 400', async () => {
  const cart = {
    ...baseCart,
    payment_collection: { payment_sessions: [{ provider_id: COD, status: 'pending' }] },
  }
  const settings = { [COD]: { ...defaultSettings(COD), countries: { mode: 'include' as const, countries: ['hr'] } } }
  await assert.rejects(complete(cart, settings), (e: any) => e.message === 'manual_payment_not_allowed:country')
})

test('cart complete ignores canceled sessions and allowed providers', async () => {
  const settings = { [COD]: { ...defaultSettings(COD), countries: { mode: 'include' as const, countries: ['hr'] } } }
  const canceled = {
    ...baseCart,
    payment_collection: {
      payment_sessions: [
        { provider_id: COD, status: 'canceled' },
        { provider_id: 'pp_stripe_stripe', status: 'pending' },
      ],
    },
  }
  assert.deepEqual(await complete(canceled, settings), ['next'])
})

test('cart complete with the fee the paying provider charges → next', async () => {
  const cart = {
    ...baseCart,
    total: 51.99,
    items: [...baseCart.items, codFeeItem],
    payment_collection: { payment_sessions: [{ provider_id: COD, status: 'pending' }] },
  }
  const settings = { [COD]: { ...defaultSettings(COD), fee: { eur: 1.99 } } }
  assert.deepEqual(await complete(cart, settings), ['next'])
})

test('cart complete without the fee its provider charges → fee added, then 400 fee_changed', async () => {
  const cart = { ...baseCart, payment_collection: { payment_sessions: [{ provider_id: COD, status: 'pending' }] } }
  const settings = { [COD]: { ...defaultSettings(COD), fee: { eur: 1.99 } } }
  const { log, flows, registrations, next } = setup(cart, settings)
  const req = createRequest({ params: { id: 'cart_1' } } as never, registrations)

  await assert.rejects(
    guardCartCompletion(flows as never)(req, createResponse().res, next),
    (e: any) => e.message === 'manual_payment_not_allowed:fee_changed',
  )
  assert.equal(log.length, 1)
  assert.equal((log[0] as [string, any])[0], 'add')
  assert.equal((log[0] as [string, any])[1].items[0].unit_price, 1.99)
})

test('cart complete with a fee at a stale amount → replaced, then 400 fee_changed', async () => {
  const cart = {
    ...baseCart,
    items: [...baseCart.items, codFeeItem],
    payment_collection: { payment_sessions: [{ provider_id: COD, status: 'pending' }] },
  }
  const settings = { [COD]: { ...defaultSettings(COD), fee: { eur: 2.49 } } }
  const { log, flows, registrations, next } = setup(cart, settings)
  const req = createRequest({ params: { id: 'cart_1' } } as never, registrations)

  await assert.rejects(
    guardCartCompletion(flows as never)(req, createResponse().res, next),
    (e: any) => e.message === 'manual_payment_not_allowed:fee_changed',
  )
  assert.deepEqual(
    log.map((entry) => (entry as [string])[0]),
    ['delete', 'add'],
  )
})

test('cart complete paying a non-manual provider with a leftover fee → fee removed, then 400 fee_changed', async () => {
  const cart = {
    ...baseCart,
    items: [...baseCart.items, codFeeItem],
    payment_collection: { payment_sessions: [{ provider_id: 'pp_stripe_stripe', status: 'pending' }] },
  }
  const { log, flows, registrations, next } = setup(cart, {})
  const req = createRequest({ params: { id: 'cart_1' } } as never, registrations)

  await assert.rejects(
    guardCartCompletion(flows as never)(req, createResponse().res, next),
    (e: any) => e.message === 'manual_payment_not_allowed:fee_changed',
  )
  assert.deepEqual(log, [['delete', { cart_id: 'cart_1', ids: ['item_fee'] }]])
})

test('a product item tagged with the fee metadata is not treated as a fee item', async () => {
  const tagged = { ...baseCart.items[0], id: 'item_tagged', total: 500, metadata: { manual_payment_fee: COD } }
  const cart = { ...baseCart, total: 550, items: [...baseCart.items, tagged] }

  assert.deepEqual(await postSession('pp_stripe_stripe', cart, {}), ['next'])

  const settings = { [COD]: { ...defaultSettings(COD), max_total: { eur: 100 } } }
  await assert.rejects(
    postSession(COD, cart, settings),
    (e: any) => e.message === 'manual_payment_not_allowed:max_total',
  )

  const withFee = { [COD]: { ...defaultSettings(COD), fee: { eur: 1.99 } } }
  const log = await postSession(COD, cart, withFee)
  assert.deepEqual(
    log.map((l) => (Array.isArray(l) ? l[0] : l)),
    ['add', 'next'],
  )
})

// Translations: the fee title is the fee label translated for the cart locale, else the request locale.
afterEach(() => {
  FeatureFlag.setFlag('translation', false)
})

const translatedSession = async (cart: unknown, locale?: string) => {
  FeatureFlag.setFlag('translation', true)
  const settings = { [COD]: { ...defaultSettings(COD), id: 'mpps_cod', fee: { eur: 1.99 } } }
  const { log, flows, registrations, next } = setup(cart, settings)
  const req = createRequest({ params: { id: 'paycol_1' }, body: { provider_id: COD }, locale } as never, registrations)
  await guardPaymentSession(flows as never)(req, createResponse().res, next)

  return log.map((l) => {
    return Array.isArray(l) && l[0] === 'add' ? ['add', (l[1] as any).items[0].title] : l
  })
}

test('the fee title is translated for the cart locale, before the request locale', async () => {
  assert.deepEqual(await translatedSession({ ...baseCart, locale: 'sl' }, 'en'), [['add', 'Provizija'], 'next'])
  assert.deepEqual(await translatedSession({ ...baseCart, locale: 'en' }, 'sl'), [['add', 'Payment Fee'], 'next'])
})

test('without a cart locale the request locale translates the fee title', async () => {
  assert.deepEqual(await translatedSession({ ...baseCart, locale: null }, 'sl'), [['add', 'Provizija'], 'next'])
  assert.deepEqual(await translatedSession(baseCart), [['add', 'Payment Fee'], 'next'])
})

test('a fee item titled for another locale is replaced; one with the translated title is kept', async () => {
  const cart = { ...baseCart, locale: 'sl', items: [...baseCart.items, codFeeItem] }
  assert.deepEqual(await translatedSession(cart), [
    ['delete', { cart_id: 'cart_1', ids: ['item_fee'] }],
    ['add', 'Provizija'],
    'next',
  ])

  const kept = { ...cart, items: [...baseCart.items, { ...codFeeItem, title: 'Provizija' }] }
  assert.deepEqual(await translatedSession(kept), ['next'])
})
