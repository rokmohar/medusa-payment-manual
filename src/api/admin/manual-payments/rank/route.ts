import type { MedusaRequest, MedusaResponse } from '@medusajs/framework'
import { MedusaError } from '@medusajs/framework/utils'
import { loadManualProviders } from '../../../../lib/providers'
import { MANUAL_PAYMENT_MODULE } from '../../../../modules/manual-payment'
import type ManualPaymentModuleService from '../../../../modules/manual-payment/service'
import type { AdminProvidersResponse } from '../route'
import type { AdminRankManualProvidersType } from '../validators'

/** Sets each provider's rank to its index in `provider_ids`, which must list every registered manual provider once. */
export async function POST(
  req: MedusaRequest<AdminRankManualProvidersType>,
  res: MedusaResponse<AdminProvidersResponse>,
) {
  const { provider_ids } = req.validatedBody
  const registered = (await loadManualProviders(req.scope)).map((p) => {
    return p.provider_id
  })
  const unique = new Set(provider_ids)

  if (
    unique.size !== provider_ids.length ||
    unique.size !== registered.length ||
    !registered.every((id) => {
      return unique.has(id)
    })
  ) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `provider_ids must list each manual payment provider exactly once: ${registered.join(', ')}`,
    )
  }

  await req.scope.resolve<ManualPaymentModuleService>(MANUAL_PAYMENT_MODULE).setRanks(provider_ids)

  res.json({ providers: await loadManualProviders(req.scope) })
}
