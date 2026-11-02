import type { MedusaRequest, MedusaResponse } from '@medusajs/framework'
import { ContainerRegistrationKeys, MedusaError } from '@medusajs/framework/utils'
import { type PaymentType, providerTypes } from '../../../../lib/payment-type'
import { defaultSettings, isManualProviderId, parseSettings } from '../../../../lib/settings'
import type { ProviderSettings, StoredSettings } from '../../../../lib/types'
import { MANUAL_PAYMENT_MODULE } from '../../../../modules/manual-payment'
import type ManualPaymentModuleService from '../../../../modules/manual-payment/service'

export const manualProviderId = (req: MedusaRequest): string => {
  const id = req.params.provider_id

  if (!isManualProviderId(id)) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Payment provider ${id} is not a manual payment provider`)
  }

  return id
}

// `settings.id` is the stored row's id (translations reference it); absent while the defaults are shown.
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse<{ type: PaymentType; settings: StoredSettings | ProviderSettings }>,
) {
  const provider_id = manualProviderId(req)
  const settings = await req.scope.resolve<ManualPaymentModuleService>(MANUAL_PAYMENT_MODULE).getSettings(provider_id)
  const type = providerTypes(req.scope.resolve(ContainerRegistrationKeys.CONFIG_MODULE)).get(provider_id) ?? 'other'

  res.json({ type, settings: settings ?? defaultSettings(provider_id) })
}

export async function POST(req: MedusaRequest, res: MedusaResponse<{ settings: StoredSettings }>) {
  const provider_id = manualProviderId(req)
  const settings = await req.scope
    .resolve<ManualPaymentModuleService>(MANUAL_PAYMENT_MODULE)
    .upsertSettings(parseSettings(provider_id, req.body))

  res.json({ settings })
}
