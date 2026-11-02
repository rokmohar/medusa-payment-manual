import assert from 'node:assert/strict'
import { test } from 'node:test'
import { needsImpactConfirmation } from '../../src/lib/impact'

const base = { capture_mode: 'manual', auto_cancel_enabled: false, auto_cancel_days: null } as const

test('needsImpactConfirmation: capture mode', () => {
  assert.equal(needsImpactConfirmation(base, base), false)
  assert.equal(needsImpactConfirmation(base, { ...base, capture_mode: 'on_order' }), true)
  assert.equal(
    needsImpactConfirmation({ ...base, capture_mode: 'on_order' }, { ...base, capture_mode: 'on_delivery' }),
    true,
  )
  assert.equal(needsImpactConfirmation({ ...base, capture_mode: 'on_order' }, base), false)
  assert.equal(
    needsImpactConfirmation({ ...base, capture_mode: 'on_order' }, { ...base, capture_mode: 'on_order' }),
    false,
  )
})

test('needsImpactConfirmation: auto-cancel', () => {
  const on = { ...base, auto_cancel_enabled: true, auto_cancel_days: 7 }

  assert.equal(needsImpactConfirmation(base, on), true)
  assert.equal(needsImpactConfirmation(on, base), false)
  assert.equal(needsImpactConfirmation(on, { ...on, auto_cancel_days: 3 }), true)
  assert.equal(needsImpactConfirmation(on, { ...on, auto_cancel_days: 14 }), false)
  assert.equal(needsImpactConfirmation(on, { ...on, auto_cancel_days: null }), false)
  assert.equal(needsImpactConfirmation({ ...on, auto_cancel_days: null }, on), true)
})
