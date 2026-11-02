import type { MedusaContainer } from '@medusajs/framework/types'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import { cancelOrderWorkflow } from '@medusajs/medusa/core-flows'
import { loadPaymentCandidates } from '../lib/candidates'
import { selectOrdersToCancel } from '../lib/selection'
import { MANUAL_PAYMENT_MODULE } from '../modules/manual-payment'
import type ManualPaymentModuleService from '../modules/manual-payment/service'

export const createCancelUnpaidOrdersJob = (flows = { cancelOrderWorkflow }) => {
  return async (container: MedusaContainer): Promise<void> => {
    const all = await container.resolve<ManualPaymentModuleService>(MANUAL_PAYMENT_MODULE).listSettings()
    const settings = new Map(
      all
        .filter((s) => {
          return s.auto_cancel_enabled && (s.auto_cancel_days ?? 0) >= 1
        })
        .map((s) => {
          return [s.provider_id, s]
        }),
    )

    if (!settings.size) {
      return
    }

    const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
    const candidates = await loadPaymentCandidates(container, [...settings.keys()])

    for (const order_id of selectOrdersToCancel(candidates, settings, new Date())) {
      try {
        await flows.cancelOrderWorkflow(container).run({ input: { order_id } })
      } catch (e) {
        logger.error(
          `manual-payment: auto-cancel failed for ${order_id}`,
          e instanceof Error ? e : new Error(String(e)),
        )
      }
    }
  }
}

export default createCancelUnpaidOrdersJob()

export const config = { name: 'manual-payment-cancel-unpaid', schedule: '0 * * * *' }
