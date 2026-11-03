import { MedusaError } from '@medusajs/framework/utils'
import { z } from 'zod'
import { parseRow } from '../../lib/parse'
import { parseSettings, providerSettingRowSchema, validateSettings } from '../../lib/settings'
import type { ProviderSettings, StoredSettings } from '../../lib/types'

const manualPaymentOrderSchema = z.object({
  id: z.string(),
  order_id: z.string(),
  provider_id: z.string(),
  reference: z.string().nullable(),
})

export type ManualPaymentOrderDTO = z.output<typeof manualPaymentOrderSchema>

// Returns the normalised settings; throws INVALID_DATA on a bad shape or a rule violation.
export const assertValidSettings = (input: ProviderSettings): ProviderSettings => {
  const s = parseSettings(input.provider_id, input)
  const errors = validateSettings(s)

  if (errors.length) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, errors.join('; '))
  }

  return s
}

// Validates a model row into the ProviderSettings fields plus the row id (drops timestamps).
export const toProviderSettings = (row: unknown): StoredSettings => {
  return parseRow(providerSettingRowSchema, row, 'provider settings row')
}

export const toManualPaymentOrder = (row: unknown): ManualPaymentOrderDTO => {
  return parseRow(manualPaymentOrderSchema, row, 'manual payment order row')
}

export type SettingsRepo = {
  remove: (ids: string[]) => Promise<unknown>
  create: (data: ProviderSettings & { id?: string }) => Promise<unknown>
}

/**
 * Full replace: drop the provider's existing rows (`existingIds`), then insert it again under the first id, which
 * translations reference. Never updates, because Medusa's update deep-merges JSON columns and would keep stale keys.
 */
export const replaceSettings = async (
  repo: SettingsRepo,
  s: ProviderSettings,
  existingIds: string[],
): Promise<StoredSettings> => {
  const id = existingIds.at(0)

  if (existingIds.length) {
    await repo.remove(existingIds)
  }

  return toProviderSettings(await repo.create(id ? { ...s, id } : s))
}
