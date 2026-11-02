import assert from 'node:assert/strict'
import { test } from 'node:test'
import { selectBankAccounts } from '../../src/lib/accounts'
import type { BankAccount } from '../../src/lib/types'

const acc = (id: string, countries: string[]): BankAccount => ({
  id,
  recipient: 'R',
  address_1: null,
  postal_code: null,
  city: null,
  country_code: null,
  iban: 'SI56263300012039086',
  bic: null,
  bank_name: null,
  countries,
})
const [A, B, C] = [acc('A', []), acc('B', ['hr']), acc('C', ['hr', 'at'])]

test('selectBankAccounts', () => {
  assert.deepEqual(selectBankAccounts([A, B, C], 'hr'), [B, C])
  assert.deepEqual(selectBankAccounts([A, B, C], 'si'), [A])
  assert.deepEqual(selectBankAccounts([A, B, C], null), [A])
  assert.deepEqual(selectBankAccounts([], 'hr'), [])
})
