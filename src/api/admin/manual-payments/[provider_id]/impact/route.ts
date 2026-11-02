import type { MedusaRequest, MedusaResponse } from '@medusajs/framework'
import { MedusaError } from '@medusajs/framework/utils'
import { z } from 'zod'
import { loadPaymentCandidates } from '../../../../../lib/candidates'
import { formatIssues } from '../../../../../lib/parse'
import { selectOrdersToCancel, selectPaymentsToCapture } from '../../../../../lib/selection'
import { defaultSettings } from '../../../../../lib/settings'
import type { ProviderSettings } from '../../../../../lib/types'
import { MANUAL_PAYMENT_MODULE } from '../../../../../modules/manual-payment'
import type ManualPaymentModuleService from '../../../../../modules/manual-payment/service'
import { manualProviderId } from '../route'

const impactSchema = z.object({
  capture_mode: z.enum(['manual', 'on_order', 'on_delivery']),
  auto_cancel_enabled: z.boolean(),
  auto_cancel_days: z.number().int().min(1).nullable(),
})

// Dry run of the capture/cancel jobs with the proposed values; reuses the jobs' selection functions.
export async function POST(req: MedusaRequest, res: MedusaResponse<{ capture: number; cancel: number }>) {
  const provider_id = manualProviderId(req)
  const parsed = impactSchema.safeParse(req.body)

  if (!parsed.success) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, formatIssues(parsed.error))
  }

  const all = await req.scope.resolve<ManualPaymentModuleService>(MANUAL_PAYMENT_MODULE).listSettings()
  const settings = new Map<string, ProviderSettings>(
    all.map((s) => {
      return [s.provider_id, s]
    }),
  )

  settings.set(provider_id, { ...(settings.get(provider_id) ?? defaultSettings(provider_id)), ...parsed.data })

  const candidates = await loadPaymentCandidates(req.scope, [provider_id])

  res.json({
    capture: selectPaymentsToCapture(candidates, settings).length,
    cancel: selectOrdersToCancel(candidates, settings, new Date()).length,
  })
}
