import assert from 'node:assert/strict'
import { test } from 'node:test'
import { feeMatches, feeProviderOf, planFee } from '../../src/lib/fee'
import { defaultSettings } from '../../src/lib/settings'
import type { ProviderSettings } from '../../src/lib/types'

const COD = 'pp_manual_cod'
const BANK = 'pp_manual_bank'
const cod = (o: Partial<ProviderSettings> = {}): ProviderSettings => ({
  ...defaultSettings(COD),
  fee: { eur: 1.99 },
  ...o,
})
const codItem = { id: 'item_cod', provider_id: COD, unit_price: 1.99, title: 'Payment Fee' }

test('COD with a fee and no item adds the fee with the default label', () => {
  assert.deepEqual(planFee({ provider_id: COD, currency_code: 'eur', fee_items: [], settings: cod() }), {
    remove: [],
    add: { amount: 1.99, title: 'Payment Fee' },
  })
})

test('COD with its item present does nothing', () => {
  assert.deepEqual(planFee({ provider_id: COD, currency_code: 'eur', fee_items: [codItem], settings: cod() }), {
    remove: [],
    add: null,
  })
})

test('duplicate fee items for the selected provider keep only one', () => {
  const dup = { ...codItem, id: 'item_cod_2' }
  assert.deepEqual(planFee({ provider_id: COD, currency_code: 'eur', fee_items: [codItem, dup], settings: cod() }), {
    remove: ['item_cod_2'],
    add: null,
  })
})

test('Stripe selected with a COD item removes it and adds nothing', () => {
  assert.deepEqual(
    planFee({ provider_id: 'pp_stripe_stripe', currency_code: 'eur', fee_items: [codItem], settings: null }),
    { remove: ['item_cod'], add: null },
  )
})

test('bank transfer with a COD item removes it and adds its own fee when set', () => {
  assert.deepEqual(
    planFee({ provider_id: BANK, currency_code: 'eur', fee_items: [codItem], settings: defaultSettings(BANK) }),
    { remove: ['item_cod'], add: null },
  )
  assert.deepEqual(
    planFee({
      provider_id: BANK,
      currency_code: 'eur',
      fee_items: [codItem],
      settings: { ...defaultSettings(BANK), fee: { eur: 0.5 }, fee_label: 'Bank fee' },
    }),
    { remove: ['item_cod'], add: { amount: 0.5, title: 'Bank fee' } },
  )
})

test('currency without a fee amount adds nothing and drops a stale own item', () => {
  assert.deepEqual(planFee({ provider_id: COD, currency_code: 'usd', fee_items: [], settings: cod() }), {
    remove: [],
    add: null,
  })
  assert.deepEqual(planFee({ provider_id: COD, currency_code: 'USD', fee_items: [codItem], settings: cod() }), {
    remove: ['item_cod'],
    add: null,
  })
})

test('zero fee and blank label', () => {
  assert.equal(
    planFee({ provider_id: COD, currency_code: 'eur', fee_items: [], settings: cod({ fee: { eur: 0 } }) }).add,
    null,
  )
  assert.deepEqual(
    planFee({ provider_id: COD, currency_code: 'eur', fee_items: [], settings: cod({ fee_label: '  ' }) }).add,
    { amount: 1.99, title: 'Payment Fee' },
  )
})

test('own item with a changed amount or label is replaced', () => {
  assert.deepEqual(
    planFee({
      provider_id: COD,
      currency_code: 'eur',
      fee_items: [{ ...codItem, unit_price: 1.5 }],
      settings: cod(),
    }),
    { remove: ['item_cod'], add: { amount: 1.99, title: 'Payment Fee' } },
  )
  assert.deepEqual(
    planFee({ provider_id: COD, currency_code: 'eur', fee_items: [codItem], settings: cod({ fee_label: 'COD fee' }) }),
    { remove: ['item_cod'], add: { amount: 1.99, title: 'COD fee' } },
  )
})

test('own item is kept when amount and label match (exact decimals)', () => {
  assert.deepEqual(
    planFee({
      provider_id: COD,
      currency_code: 'eur',
      fee_items: [{ ...codItem, unit_price: 0.3, title: 'COD fee' }],
      settings: cod({ fee: { eur: 0.3 }, fee_label: ' COD fee ' }),
    }),
    { remove: [], add: null },
  )
})

test('fee removed by the admin drops the own item', () => {
  assert.deepEqual(
    planFee({ provider_id: COD, currency_code: 'eur', fee_items: [codItem], settings: cod({ fee: null }) }),
    {
      remove: ['item_cod'],
      add: null,
    },
  )
})

test('feeProviderOf: only variant-less items tagged with a provider id are our fee', () => {
  assert.equal(feeProviderOf({ metadata: { manual_payment_fee: COD }, variant_id: null }), COD)
  assert.equal(feeProviderOf({ metadata: { manual_payment_fee: COD }, variant_id: 'variant_1' }), null)
  assert.equal(feeProviderOf({ metadata: { manual_payment_fee: 1 }, variant_id: null }), null)
  assert.equal(feeProviderOf({ metadata: null }), null)
})

test('feeMatches: the paying provider with its one fee at the configured amount, whatever the title', () => {
  const input = { provider_id: COD, currency_code: 'eur', settings: cod() }

  assert.equal(feeMatches({ ...input, fee_items: [codItem] }), true)
  assert.equal(feeMatches({ ...input, fee_items: [{ ...codItem, title: 'Provizija' }] }), true)
  assert.equal(feeMatches({ ...input, fee_items: [] }), false)
  assert.equal(feeMatches({ ...input, fee_items: [{ ...codItem, unit_price: 0.99 }] }), false)
  assert.equal(feeMatches({ ...input, fee_items: [codItem, { ...codItem, id: 'item_cod_2' }] }), false)
  assert.equal(feeMatches({ ...input, fee_items: [{ ...codItem, provider_id: BANK }] }), false)
})

test('feeMatches: a provider without a fee matches only a cart without fee items', () => {
  const input = { provider_id: 'pp_stripe_stripe', currency_code: 'eur', settings: null }

  assert.equal(feeMatches({ ...input, fee_items: [] }), true)
  assert.equal(feeMatches({ ...input, fee_items: [codItem] }), false)
})
