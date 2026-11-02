import assert from 'node:assert/strict'
import { test } from 'node:test'
import { selectOrdersToCancel, selectPaymentsToCapture, type PaymentCandidate } from '../../src/lib/selection'
import { defaultSettings } from '../../src/lib/settings'
import type { ProviderSettings } from '../../src/lib/types'

const P = 'pp_manual_cod'
const NOW = new Date('2026-01-10T12:00:00Z')
const day = 86_400_000
const cand = (o: Partial<PaymentCandidate> = {}): PaymentCandidate => ({
  payment_id: 'pay_1',
  provider_id: P,
  order_id: 'order_1',
  order_created_at: new Date(NOW.getTime() - 8 * day),
  order_status: 'pending',
  order_has_capture: false,
  payment_canceled: false,
  has_capture: false,
  has_refund: false,
  has_fulfillment: false,
  has_delivered_fulfillment: false,
  ...o,
})
const settings = (o: Partial<ProviderSettings> = {}) => new Map([[P, { ...defaultSettings(P), ...o }]])

test('capture selection', () => {
  const on_order = settings({ capture_mode: 'on_order' })
  const on_delivery = settings({ capture_mode: 'on_delivery' })

  assert.deepEqual(selectPaymentsToCapture([cand()], on_order), ['pay_1'])
  assert.deepEqual(selectPaymentsToCapture([cand()], on_delivery), [])
  assert.deepEqual(selectPaymentsToCapture([cand({ has_delivered_fulfillment: true })], on_delivery), ['pay_1'])
  assert.deepEqual(selectPaymentsToCapture([cand()], settings({ capture_mode: 'manual' })), [])

  for (const o of [
    { has_capture: true },
    { has_refund: true },
    { payment_canceled: true },
    { order_status: 'canceled' },
    { order_status: 'draft' },
    { order_status: 'archived' },
  ]) {
    assert.deepEqual(selectPaymentsToCapture([cand(o)], on_order), [])
  }

  assert.deepEqual(selectPaymentsToCapture([cand({ order_status: 'completed' })], on_order), ['pay_1'])
  assert.deepEqual(selectPaymentsToCapture([cand({ order_has_capture: true })], on_order), ['pay_1'])
  assert.deepEqual(selectPaymentsToCapture([cand()], new Map()), [])
})

test('cancel selection', () => {
  const on = settings({ auto_cancel_enabled: true, auto_cancel_days: 7 })

  assert.deepEqual(selectOrdersToCancel([cand()], on, NOW), ['order_1'])
  assert.deepEqual(selectOrdersToCancel([cand({ order_created_at: new Date(NOW.getTime() - 6 * day) })], on, NOW), [])
  assert.deepEqual(selectOrdersToCancel([cand({ order_created_at: new Date(NOW.getTime() - 7 * day) })], on, NOW), [])
  assert.deepEqual(selectOrdersToCancel([cand({ has_fulfillment: true })], on, NOW), [])
  assert.deepEqual(selectOrdersToCancel([cand({ has_capture: true })], on, NOW), [])
  assert.deepEqual(selectOrdersToCancel([cand({ order_has_capture: true })], on, NOW), [])
  assert.deepEqual(selectOrdersToCancel([cand({ order_status: 'requires_action' })], on, NOW), ['order_1'])
  for (const order_status of ['completed', 'draft', 'archived']) {
    assert.deepEqual(selectOrdersToCancel([cand({ order_status })], on, NOW), [])
  }
  assert.deepEqual(selectOrdersToCancel([cand({ order_status: 'canceled' })], on, NOW), [])
  assert.deepEqual(
    selectOrdersToCancel([cand()], settings({ auto_cancel_enabled: false, auto_cancel_days: 7 }), NOW),
    [],
  )
  assert.deepEqual(
    selectOrdersToCancel([cand()], settings({ auto_cancel_enabled: true, auto_cancel_days: null }), NOW),
    [],
  )
  assert.deepEqual(
    selectOrdersToCancel([cand()], settings({ auto_cancel_enabled: true, auto_cancel_days: 0 }), NOW),
    [],
  )
  assert.deepEqual(selectOrdersToCancel([cand(), cand({ payment_id: 'pay_2' })], on, NOW), ['order_1'])
})
