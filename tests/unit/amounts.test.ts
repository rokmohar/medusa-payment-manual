import assert from 'node:assert/strict'
import { test } from 'node:test'
import { amountCurrencies, cellsToAmounts, parseAmount, pruneAmounts } from '../../src/lib/amounts'

const none = { min_total: null, max_total: null, fee: null }

test('parseAmount reads amount cells: blank is null, unusable text is undefined', () => {
  assert.equal(parseAmount(''), null)
  assert.equal(parseAmount('  '), null)
  assert.equal(parseAmount(' 10.5 '), 10.5)
  assert.equal(parseAmount('1234.56'), 1234.56)
  assert.equal(parseAmount('0'), 0)
  assert.equal(parseAmount('1.'), undefined)
  assert.equal(parseAmount('1,5'), undefined)
  assert.equal(parseAmount('-1'), undefined)
  assert.equal(parseAmount('1e3'), undefined)
})

test('amountCurrencies follows the currency rule', () => {
  const store = ['eur', 'usd', 'gbp']

  assert.deepEqual(amountCurrencies(store, null, none), ['eur', 'usd', 'gbp'])
  assert.deepEqual(amountCurrencies(store, { mode: 'all', currencies: [] }, none), ['eur', 'usd', 'gbp'])
  assert.deepEqual(amountCurrencies(store, { mode: 'include', currencies: ['gbp', 'eur'] }, none), ['eur', 'gbp'])
  assert.deepEqual(amountCurrencies(store, { mode: 'exclude', currencies: ['usd'] }, none), ['eur', 'gbp'])
})

test('amountCurrencies keeps a saved currency the store no longer supports, unless the rule excludes it', () => {
  const saved = { ...none, fee: { chf: 2 } }

  assert.deepEqual(amountCurrencies(['eur'], null, saved), ['eur', 'chf'])
  assert.deepEqual(amountCurrencies(['eur'], { mode: 'exclude', currencies: ['chf'] }, saved), ['eur'])
})

test('pruneAmounts drops amounts for currencies the rule excludes and nulls emptied maps', () => {
  const amounts = { min_total: { eur: 10, usd: 12 }, max_total: { usd: 500 }, fee: null }

  assert.deepEqual(pruneAmounts({ ...amounts, currencies: null }), amounts)
  assert.deepEqual(pruneAmounts({ ...amounts, currencies: { mode: 'include', currencies: ['eur'] } }), {
    min_total: { eur: 10 },
    max_total: null,
    fee: null,
  })
  assert.deepEqual(pruneAmounts({ ...amounts, currencies: { mode: 'exclude', currencies: ['eur'] } }), {
    min_total: { usd: 12 },
    max_total: { usd: 500 },
    fee: null,
  })
})

test('cellsToAmounts reads the shown currencies: loaded numbers, typed text, blanks, and unusable cells', () => {
  const { amounts, invalid } = cellsToAmounts(
    {
      min_total: { eur: 10, usd: '' },
      max_total: { eur: '250.50', usd: undefined },
      fee: { eur: '1,5', usd: null, gbp: 3 },
    },
    ['eur', 'usd'],
  )

  assert.deepEqual(amounts, { min_total: { eur: 10 }, max_total: { eur: 250.5 }, fee: null })
  assert.deepEqual(invalid, [['fee', 'eur']])
})
