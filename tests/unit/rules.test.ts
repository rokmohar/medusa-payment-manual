import assert from 'node:assert/strict'
import { test } from 'node:test'
import { evaluateRules } from '../../src/lib/rules'
import { defaultSettings } from '../../src/lib/settings'
import type { CartContext, ProviderSettings } from '../../src/lib/types'

const cart = (o: Partial<CartContext> = {}): CartContext => ({
  currency_code: 'eur',
  total: 50,
  country_code: 'si',
  shipping_option_ids: ['so_1'],
  ...o,
})
const s = (o: Partial<ProviderSettings>): ProviderSettings => ({ ...defaultSettings('pp_manual_x'), ...o })
const reason = (x: ReturnType<typeof evaluateRules>) => (x.allowed ? null : x.reason)

test('null and defaults allow', () => {
  assert.deepEqual(evaluateRules(null, cart()), { allowed: true })
  assert.deepEqual(evaluateRules(s({}), cart()), { allowed: true })
})

test('a disabled provider is denied first', () => {
  assert.equal(reason(evaluateRules(s({ enabled: false }), cart())), 'disabled')
  assert.equal(
    reason(evaluateRules(s({ enabled: false, currencies: { mode: 'include', currencies: ['usd'] } }), cart())),
    'disabled',
  )
  assert.equal(evaluateRules(s({ enabled: true }), cart()).allowed, true)
})

test('countries', () => {
  const inc = s({ countries: { mode: 'include', countries: ['si'] } })

  assert.equal(reason(evaluateRules(inc, cart({ country_code: null }))), 'country')
  assert.equal(reason(evaluateRules(inc, cart({ country_code: 'hr' }))), 'country')
  assert.equal(evaluateRules(inc, cart()).allowed, true)
  assert.equal(reason(evaluateRules(s({ countries: { mode: 'exclude', countries: ['si'] } }), cart())), 'country')
  assert.equal(
    reason(evaluateRules(s({ countries: { mode: 'exclude', countries: ['si'] } }), cart({ country_code: null }))),
    'country',
  )
  assert.equal(evaluateRules(s({ countries: { mode: 'all', countries: ['hr'] } }), cart()).allowed, true)
})

test('totals are inclusive and per currency', () => {
  const min = s({ min_total: { eur: 10 } })

  assert.equal(reason(evaluateRules(min, cart({ total: 9.99 }))), 'min_total')
  assert.equal(evaluateRules(min, cart({ total: 10 })).allowed, true)
  assert.equal(evaluateRules(min, cart({ total: 1, currency_code: 'usd' })).allowed, true)

  const max = s({ max_total: { eur: 300 } })

  assert.equal(evaluateRules(max, cart({ total: 300 })).allowed, true)
  assert.equal(reason(evaluateRules(max, cart({ total: 300.01 }))), 'max_total')
})

test('currencies: include, exclude, all', () => {
  const inc = s({ currencies: { mode: 'include', currencies: ['eur'] } })

  assert.equal(reason(evaluateRules(inc, cart({ currency_code: 'usd' }))), 'currency')
  assert.equal(evaluateRules(inc, cart({ currency_code: 'EUR' })).allowed, true)

  const exc = s({ currencies: { mode: 'exclude', currencies: ['eur'] } })

  assert.equal(reason(evaluateRules(exc, cart({ currency_code: 'EUR' }))), 'currency')
  assert.equal(evaluateRules(exc, cart({ currency_code: 'usd' })).allowed, true)
  assert.equal(evaluateRules(s({ currencies: { mode: 'all', currencies: ['usd'] } }), cart()).allowed, true)
})

test('shipping options: include, exclude, all, and no shipping method yet', () => {
  const inc = s({ shipping_option_ids: { mode: 'include', shipping_option_ids: ['so_1'] } })

  assert.equal(reason(evaluateRules(inc, cart({ shipping_option_ids: ['so_2'] }))), 'shipping_option')
  assert.equal(reason(evaluateRules(inc, cart({ shipping_option_ids: [] }))), 'shipping_option')
  assert.equal(evaluateRules(inc, cart()).allowed, true)
  assert.equal(evaluateRules(inc, cart({ shipping_option_ids: ['so_2', 'so_1'] })).allowed, true)

  const exc = s({ shipping_option_ids: { mode: 'exclude', shipping_option_ids: ['so_1'] } })

  assert.equal(reason(evaluateRules(exc, cart())), 'shipping_option')
  assert.equal(reason(evaluateRules(exc, cart({ shipping_option_ids: ['so_2', 'so_1'] }))), 'shipping_option')
  assert.equal(evaluateRules(exc, cart({ shipping_option_ids: ['so_2'] })).allowed, true)
  assert.equal(evaluateRules(exc, cart({ shipping_option_ids: [] })).allowed, true)
  assert.equal(
    evaluateRules(s({ shipping_option_ids: { mode: 'all', shipping_option_ids: ['so_2'] } }), cart()).allowed,
    true,
  )
})

test('check order', () => {
  const all = s({
    countries: { mode: 'include', countries: ['hr'] },
    currencies: { mode: 'include', currencies: ['usd'] },
    min_total: { eur: 100 },
    max_total: { eur: 1 },
    shipping_option_ids: { mode: 'include', shipping_option_ids: ['x'] },
  })

  assert.equal(reason(evaluateRules(all, cart())), 'country')
  assert.equal(reason(evaluateRules({ ...all, countries: null }, cart())), 'currency')
  assert.equal(reason(evaluateRules({ ...all, countries: null, currencies: null }, cart())), 'min_total')
  assert.equal(
    reason(evaluateRules({ ...all, countries: null, currencies: null, min_total: null }, cart())),
    'max_total',
  )
  assert.equal(
    reason(evaluateRules({ ...all, countries: null, currencies: null, min_total: null, max_total: null }, cart())),
    'shipping_option',
  )
})
