import assert from 'node:assert/strict'
import { test } from 'node:test'
import { withSelected } from '../../src/lib/choices'

test('selected codes missing from the choices stay listed, labelled by code', () => {
  const choices = [{ code: 'so_1', name: 'Standard' }]

  assert.deepEqual(withSelected(choices, ['so_1', 'so_123']), [
    { code: 'so_1', name: 'Standard', label: 'Standard (so_1)' },
    { code: 'so_123', name: 'so_123', label: 'so_123 (unavailable)' },
  ])
  assert.deepEqual(withSelected(choices, []), [{ code: 'so_1', name: 'Standard', label: 'Standard (so_1)' }])
})
