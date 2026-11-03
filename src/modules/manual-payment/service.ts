import type { Context } from '@medusajs/framework/types'
import { InjectManager, InjectTransactionManager, MedusaContext, MedusaService } from '@medusajs/framework/utils'
import { defaultSettings } from '../../lib/settings'
import type { ProviderSettings, StoredSettings } from '../../lib/types'
import { assertValidSettings, replaceSettings, toProviderSettings } from './mappers'
import ManualPaymentOrder from './models/order-payment'
import ManualPaymentProviderSetting from './models/provider-setting'

export type { ManualPaymentOrderDTO } from './mappers'

class ManualPaymentModuleService extends MedusaService({
  ManualPaymentProviderSetting,
  ManualPaymentOrder,
}) {
  async getSettings(provider_id: string): Promise<StoredSettings | null> {
    const row = (await this.listManualPaymentProviderSettings({ provider_id })).at(0)

    return row ? toProviderSettings(row) : null
  }

  async listSettings(): Promise<StoredSettings[]> {
    const rows = await this.listManualPaymentProviderSettings({})

    return rows.map((r) => {
      return toProviderSettings(r)
    })
  }

  // The id is read on this call's manager; the transaction below runs on its own fresh fork, so it hasn't loaded the
  // row: an identity map holding it would turn the create under the same id into an update of the deleted row.
  @InjectManager()
  async upsertSettings(s: ProviderSettings, @MedusaContext() sharedContext: Context = {}): Promise<StoredSettings> {
    const valid = assertValidSettings(s)
    const existing = await this.listManualPaymentProviderSettings(
      { provider_id: valid.provider_id },
      { select: ['id'] },
      sharedContext,
    )

    return await this.upsertSettings_(
      valid,
      existing.map((r) => {
        return r.id
      }),
      sharedContext,
    )
  }

  // Delete + create under the same id in one transaction (see replaceSettings).
  @InjectTransactionManager()
  protected async upsertSettings_(
    s: ProviderSettings,
    existingIds: string[],
    @MedusaContext() sharedContext: Context = {},
  ): Promise<StoredSettings> {
    return await replaceSettings(
      {
        remove: async (ids) => {
          return this.deleteManualPaymentProviderSettings(ids, sharedContext)
        },
        create: async (d) => {
          return this.createManualPaymentProviderSettings(d, sharedContext)
        },
      },
      s,
      existingIds,
    )
  }

  /**
   * Sets each provider's rank to its index in `provider_ids`, in one transaction. Existing rows are updated in place
   * (translations reference their id); a provider without a row gets the default settings.
   */
  @InjectTransactionManager()
  async setRanks(provider_ids: string[], @MedusaContext() sharedContext: Context = {}): Promise<void> {
    const existing = await this.listManualPaymentProviderSettings(
      { provider_id: provider_ids },
      { select: ['id', 'provider_id'] },
      sharedContext,
    )
    const updates = existing.map((r) => {
      return { id: r.id, rank: provider_ids.indexOf(r.provider_id) }
    })
    const creates = provider_ids
      .filter((id) => {
        return !existing.some((r) => {
          return r.provider_id === id
        })
      })
      .map((id) => {
        return { ...defaultSettings(id), rank: provider_ids.indexOf(id) }
      })

    if (updates.length) {
      await this.updateManualPaymentProviderSettings(updates, sharedContext)
    }

    if (creates.length) {
      await this.createManualPaymentProviderSettings(creates, sharedContext)
    }
  }
}

export default ManualPaymentModuleService
