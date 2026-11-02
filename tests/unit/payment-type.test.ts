import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PAYMENT_TYPES, isPaymentType, providerTypes } from '../../src/lib/payment-type'

const config = (providers: unknown[]) => ({
  modules: { payment: { resolve: '@medusajs/medusa/payment', options: { providers } } },
})
const PATH = '@rokmohar/medusa-payment-manual/providers/manual'

test('isPaymentType guards the four values', () => {
  for (const t of PAYMENT_TYPES) {
    assert.equal(isPaymentType(t), true)
  }
  assert.equal(isPaymentType('card'), false)
  assert.equal(isPaymentType(undefined), false)
})

test('providerTypes reads the type of each manual provider, defaulting to other', () => {
  const map = providerTypes(
    config([
      { resolve: PATH, id: 'cod', options: { type: 'cash_on_delivery' } },
      { resolve: PATH, id: 'bank', options: { type: 'bank_transfer' } },
      { resolve: PATH, id: 'plain' },
      { resolve: PATH, id: 'empty', options: {} },
    ]),
  )
  assert.deepEqual(
    [...map],
    [
      ['pp_manual_cod', 'cash_on_delivery'],
      ['pp_manual_bank', 'bank_transfer'],
      ['pp_manual_plain', 'other'],
      ['pp_manual_empty', 'other'],
    ],
  )
})

test('providerTypes tolerates a resolved absolute path and ignores foreign providers', () => {
  const map = providerTypes(
    config([
      {
        resolve: '/app/node_modules/@rokmohar/medusa-payment-manual/.medusa/server/src/providers/manual',
        id: 'a',
        options: { type: 'invoice' },
      },
      { resolve: '@medusajs/medusa/payment-stripe', id: 'stripe', options: { type: 'invoice' } },
      { resolve: PATH },
    ]),
  )
  assert.deepEqual([...map], [['pp_manual_a', 'invoice']])
})

test('providerTypes is empty for a config without the payment module', () => {
  assert.equal(providerTypes(undefined).size, 0)
  assert.equal(providerTypes({ modules: {} }).size, 0)
  assert.equal(providerTypes({ modules: { payment: true } }).size, 0)
})
