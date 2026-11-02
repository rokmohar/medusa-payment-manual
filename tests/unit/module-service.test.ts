import assert from 'node:assert/strict'
import { test } from 'node:test'
import { assertValidSettings, toProviderSettings } from '../../src/modules/manual-payment/mappers'
import { defaultSettings } from '../../src/lib/settings'
import type { BankAccount } from '../../src/lib/types'

const acc = (id: string): BankAccount => ({
  id,
  recipient: 'Acme',
  address_1: null,
  postal_code: null,
  city: null,
  country_code: null,
  iban: 'SI56263300012039086',
  bic: null,
  bank_name: null,
  countries: [],
})

test('two default accounts rejected with INVALID_DATA', () => {
  const s = { ...defaultSettings('pp_manual_x'), bank_accounts: [acc('a'), acc('b')] }
  assert.throws(
    () => assertValidSettings(s),
    (e: any) => e.type === 'invalid_data',
  )
})

test('default settings pass validation', () => {
  assert.doesNotThrow(() => assertValidSettings(defaultSettings('pp_manual_x')))
})

test('toProviderSettings round-trips a row', () => {
  const s = {
    ...defaultSettings('pp_manual_x'),
    countries: { mode: 'include' as const, countries: ['si'] },
    min_total: { eur: 5 },
    capture_mode: 'on_order' as const,
    bank_accounts: [acc('a')],
  }
  const row = { id: 'mpps_1', created_at: new Date(), updated_at: new Date(), deleted_at: null, ...s }
  assert.deepEqual(toProviderSettings(row), { ...s, id: 'mpps_1' })
})

import { replaceSettings, type SettingsRepo } from '../../src/modules/manual-payment/mappers'
import ManualPaymentModuleService from '../../src/modules/manual-payment/service'

const fakeRepo = (rows: Record<string, unknown>[]) => {
  const calls: string[] = []
  const repo: SettingsRepo = {
    remove: async (ids) => {
      calls.push('remove')
      rows.splice(0, rows.length, ...rows.filter((r) => !ids.includes(r.id as string)))
    },
    create: async (d) => {
      calls.push('create')
      const row = { id: 'new', ...d }
      rows.push(row)
      return row
    },
  }
  return { repo, rows, calls }
}

test('replaceSettings creates when none exists', async () => {
  const { repo, rows, calls } = fakeRepo([])
  const s = defaultSettings('pp_manual_x')
  assert.deepEqual(await replaceSettings(repo, s, []), { ...s, id: 'new' })
  assert.deepEqual(calls, ['create'])
  assert.equal(rows.length, 1)
})

// Translations reference the row id, so a save must keep it; Medusa's update would deep-merge the JSON columns.
test('replaceSettings re-creates the row under its id: no new id, no stale JSON keys', async () => {
  const old = {
    id: 'old',
    ...defaultSettings('pp_manual_x'),
    fee: { eur: 1.99, usd: 2 },
    countries: { mode: 'include' as const, countries: ['si', 'hr'] },
  }
  const { repo, rows, calls } = fakeRepo([old])
  const s = {
    ...defaultSettings('pp_manual_x'),
    fee: { eur: 1.99 },
    countries: { mode: 'all' as const, countries: [] },
  }
  const saved = await replaceSettings(repo, s, ['old'])

  assert.equal(saved.id, 'old')
  assert.deepEqual(saved.fee, { eur: 1.99 })
  assert.deepEqual(saved.countries, { mode: 'all', countries: [] })
  assert.deepEqual(calls, ['remove', 'create'])
  assert.deepEqual(rows, [{ ...s, id: 'old' }])
  assert.equal((await replaceSettings(repo, s, ['old'])).id, 'old')
})

// Service-level: stub generated methods on a prototype-less instance.
// The fake repository hands out an `outer` manager and runs transactions on a separate `tx` manager, like Medusa's.
const stubbed = (rows: Record<string, unknown>[]) => {
  const svc = Object.create(ManualPaymentModuleService.prototype) as any
  const calls: unknown[] = []
  const managers = (ctx: any) => ({ manager: ctx?.manager?.name, transactionManager: ctx?.transactionManager?.name })
  svc.baseRepository_ = {
    getFreshManager: () => ({ name: 'outer' }),
    transaction: async (task: (tm: unknown) => Promise<unknown>) => task({ name: 'tx' }),
  }
  svc.listManualPaymentProviderSettings = async (f: any, _config: unknown, ctx: any) => {
    calls.push(['list', managers(ctx)])
    return rows.filter((r) => r.provider_id === f.provider_id)
  }
  svc.createManualPaymentProviderSettings = async (d: any, ctx: any) => (calls.push(['create', d.id, managers(ctx)]), d)
  svc.deleteManualPaymentProviderSettings = async (ids: string[], ctx: any) =>
    calls.push(['delete', ids, managers(ctx)])
  return { svc, calls }
}

// The id is read on the caller's manager, before the transaction: a transaction that had loaded the row would turn
// the create under the same id into an update of the deleted row (the ORM's identity map).
test('upsertSettings reads the id outside the transaction, then deletes and re-creates under it inside', async () => {
  const s = defaultSettings('pp_manual_x')
  const { svc, calls } = stubbed([{ id: 'r', ...s }])
  const saved = await svc.upsertSettings(s)

  assert.equal(saved.id, 'r')
  assert.deepEqual(calls, [
    ['list', { manager: 'outer', transactionManager: undefined }],
    ['delete', ['r'], { manager: 'outer', transactionManager: 'tx' }],
    ['create', 'r', { manager: 'outer', transactionManager: 'tx' }],
  ])
})

test('getSettings returns null when no row', async () => {
  const { svc } = stubbed([])
  assert.equal(await svc.getSettings('pp_manual_x'), null)
})

test('getSettings maps an existing row', async () => {
  const s = defaultSettings('pp_manual_x')
  const { svc } = stubbed([{ id: 'r', ...s }])
  assert.deepEqual(await svc.getSettings('pp_manual_x'), { ...s, id: 'r' })
})

test('invalid settings throw INVALID_DATA before any repository call', async () => {
  const { svc, calls } = stubbed([])
  const s = { ...defaultSettings('pp_manual_x'), bank_accounts: [acc('a'), acc('b')] }
  await assert.rejects(svc.upsertSettings(s), (e: any) => e.type === 'invalid_data')
  assert.deepEqual(calls, [])
})

test('getSettings rejects a row with an invalid capture_mode with UNEXPECTED_STATE', async () => {
  const { svc } = stubbed([{ id: 'r', ...defaultSettings('pp_manual_x'), capture_mode: 'bogus' }])
  await assert.rejects(
    svc.getSettings('pp_manual_x'),
    (e: any) => e.type === 'unexpected_state' && e.message.includes('capture_mode'),
  )
})

// Existing rows keep their id (translations reference it); missing providers get a default row.
test('setRanks updates existing rows in place and creates defaults for the rest, in one transaction', async () => {
  const svc = Object.create(ManualPaymentModuleService.prototype) as any
  const calls: unknown[] = []
  svc.baseRepository_ = {
    getFreshManager: () => ({ name: 'outer' }),
    transaction: async (task: (tm: unknown) => Promise<unknown>) => task({ name: 'tx' }),
  }
  svc.listManualPaymentProviderSettings = async (f: any, _config: unknown, ctx: any) => {
    calls.push(['list', f, ctx.transactionManager.name])
    return [{ id: 'mpps_b', provider_id: 'pp_manual_b' }]
  }
  svc.updateManualPaymentProviderSettings = async (d: unknown, ctx: any) => {
    calls.push(['update', d, ctx.transactionManager.name])
  }
  svc.createManualPaymentProviderSettings = async (d: unknown, ctx: any) => {
    calls.push(['create', d, ctx.transactionManager.name])
  }
  await svc.setRanks(['pp_manual_b', 'pp_manual_a'])

  assert.deepEqual(calls, [
    ['list', { provider_id: ['pp_manual_b', 'pp_manual_a'] }, 'tx'],
    ['update', [{ id: 'mpps_b', rank: 0 }], 'tx'],
    ['create', [{ ...defaultSettings('pp_manual_a'), rank: 1 }], 'tx'],
  ])
})
