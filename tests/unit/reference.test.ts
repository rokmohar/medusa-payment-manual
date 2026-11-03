// Sources: SI12 modulo-11 check digit per Uradni list RS payment-operations rules (weights 2,3,4,... from the
// right, K = 11 - sum%11, worked example 102674 -> 7; 11 -> 0 and 10 -> 0). RF per ISO 11649 (Wikipedia
// "Creditor Reference": RF18 5390 0754 7034 for body 539007547034).
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildReference, referenceForQr, rfReference, schemeOfReference, si12CheckDigit } from '../../src/lib/reference'

test('buildReference: null/blank template or none scheme', () => {
  assert.equal(buildReference(null, 'SI00', 7), null)
  assert.equal(buildReference('  ', 'SI12', 7), null)
  assert.equal(buildReference('{display_id}', 'none', 42), '42')
})

test('SI00 concatenates', () => {
  assert.equal(buildReference('2026{display_id}', 'SI00', 42), 'SI00 202642')
  // UPN reference field: model (4) + reference (max 22) without spaces
  assert.equal(buildReference('{display_id}', 'SI00', '1'.repeat(22)), `SI00 ${'1'.repeat(22)}`)
  assert.equal(buildReference('{display_id}', 'SI00', '1'.repeat(23)), null)
})

test('SI12 check digit', () => {
  assert.equal(si12CheckDigit('12345'), '5')
  assert.equal(si12CheckDigit('102674'), '7') // official worked example
  assert.equal(si12CheckDigit('1'), '9') // 11 - 2
  assert.equal(si12CheckDigit('5'), '1') // 11 - 10 = 1
  assert.equal(si12CheckDigit('4'), '3')
  assert.equal(si12CheckDigit('31'), '0') // sum 11 -> r 11 -> 0
  assert.equal(si12CheckDigit('23'), '0') // sum 12 -> r 10 -> 0
  assert.equal(buildReference('{display_id}', 'SI12', 12345), 'SI12 123455')
})

test('RF', () => {
  assert.equal(rfReference('539007547034'), 'RF18539007547034')
  assert.equal(rfReference('42'), 'RF3442')
  assert.equal(buildReference('{display_id}', 'RF', 42), rfReference('42'))
  assert.equal(rfReference('ab 12'), rfReference('AB12'))
})

test('referenceForQr', () => {
  assert.equal(referenceForQr('SI12 123455'), 'SI12123455')
})

test('invalid bodies are rejected, not thrown', () => {
  assert.equal(buildReference('ORD-{display_id}', 'RF', 42), null)
  assert.equal(buildReference('{display_id}', 'SI12', '12AB'), null)
  assert.equal(buildReference('{display_id}', 'SI12', '123456789012'), null)
  assert.equal(buildReference('{display_id}', 'RF', 'A'.repeat(22)), null)
  assert.throws(() => {
    return rfReference('A-B')
  })
  assert.throws(() => {
    return si12CheckDigit('1A')
  })
})

test('string display_id and template without placeholder', () => {
  assert.equal(buildReference('{display_id}', 'SI12', '12345'), 'SI12 123455')
  assert.equal(buildReference('{display_id}', 'RF', '42'), 'RF3442')
  assert.equal(buildReference('2026', 'SI00', 1), 'SI00 2026')
  assert.equal(
    buildReference('{display_id}', 'SI12', '12345678901'),
    `SI12 12345678901${si12CheckDigit('12345678901')}`,
  )
})

test('schemeOfReference', () => {
  assert.equal(schemeOfReference('SI00 123'), 'SI00')
  assert.equal(schemeOfReference('SI12 71'), 'SI12')
  assert.equal(schemeOfReference('RF18 5390'), 'RF')
  assert.equal(schemeOfReference('ABC-1'), 'none')
  assert.equal(schemeOfReference(null), 'none')
})
