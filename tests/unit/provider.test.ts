import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ManualProviderService } from '../../src/providers/manual/service'

const make = () => new ManualProviderService({} as any, {})

test('validateOptions accepts empty options', () => {
  assert.doesNotThrow(() => ManualProviderService.validateOptions({}))
  assert.doesNotThrow(() => ManualProviderService.validateOptions(undefined as any))
})

test('validateOptions rejects legacy options', () => {
  assert.throws(() => ManualProviderService.validateOptions({ foo: 1 }), /settings moved to the admin/)
})

test('statuses', async () => {
  const p = make()

  assert.deepEqual(await p.getPaymentStatus({ data: {} }), { status: 'authorized' })
  assert.deepEqual(await p.authorizePayment({ data: {} }), { data: { type: 'other' }, status: 'authorized' })
  assert.equal('getStatus' in p, false)
  assert.equal('getPaymentData' in p, false)
})

test('validateOptions accepts a valid type and rejects an unknown type or key', () => {
  for (const type of ['bank_transfer', 'cash_on_delivery', 'invoice', 'other']) {
    assert.doesNotThrow(() => ManualProviderService.validateOptions({ type }))
  }
  assert.throws(() => ManualProviderService.validateOptions({ type: 'card' }), /type/)
  assert.throws(() => ManualProviderService.validateOptions({ type: 'invoice', foo: 1 }), /settings moved to the admin/)
})

test('every method that returns data carries the configured type', async () => {
  const p = new ManualProviderService({} as any, { type: 'cash_on_delivery' })
  const data = { type: 'cash_on_delivery' }

  assert.deepEqual((await p.initiatePayment()).data, data)
  assert.deepEqual((await p.authorizePayment({ data: {} })).data, data)
  assert.deepEqual((await p.updatePayment()).data, data)
  assert.deepEqual((await p.capturePayment()).data, data)
  assert.deepEqual((await p.refundPayment()).data, data)
  assert.deepEqual((await p.cancelPayment()).data, data)
  assert.deepEqual((await p.deletePayment()).data, data)
  assert.deepEqual((await p.retrievePayment()).data, data)
})

test('a provider without options has type other', async () => {
  assert.deepEqual((await new ManualProviderService({} as any, undefined as any).initiatePayment()).data, {
    type: 'other',
  })
  assert.deepEqual((await make().capturePayment()).data, { type: 'other' })
})
