import type { ILockingModule, MedusaContainer } from '@medusajs/framework/types'
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils'
import type { capturePaymentWorkflow } from '@medusajs/medusa/core-flows'
import { MANUAL_PAYMENT_MODULE } from '../modules/manual-payment'
import type ManualPaymentModuleService from '../modules/manual-payment/service'
import { loadPaymentCandidates } from './candidates'
import { selectPaymentsToCapture } from './selection'

export type CaptureFlows = { capturePaymentWorkflow: typeof capturePaymentWorkflow }

/**
 * Captures the payments that selectPaymentsToCapture picks (the same rule as the admin impact preview), of one order or
 * of all orders, for the providers whose capture mode is in `modes` (default: every mode but manual). Each order is
 * handled under a lock per order, with its payments picked again inside it, so the job and the delivery subscriber
 * can't capture the same payment twice. Failures are logged, never thrown.
 */
export const captureEligiblePayments = async (
  container: MedusaContainer,
  flows: CaptureFlows,
  opts: { order_id?: string; modes?: string[] } = {},
): Promise<void> => {
  const modes = opts.modes ?? ['on_order', 'on_delivery']
  const all = await container.resolve<ManualPaymentModuleService>(MANUAL_PAYMENT_MODULE).listSettings()
  const settings = new Map(
    all
      .filter((s) => {
        return modes.includes(s.capture_mode)
      })
      .map((s) => {
        return [s.provider_id, s]
      }),
  )

  if (!settings.size) {
    return
  }

  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const locking = container.resolve<ILockingModule>(Modules.LOCKING)
  const providers = [...settings.keys()]
  const candidates = await loadPaymentCandidates(container, providers, opts.order_id)
  const orders = new Set(
    candidates
      .filter((c) => {
        return selectPaymentsToCapture([c], settings).length > 0
      })
      .map((c) => {
        return c.order_id
      }),
  )

  for (const order of orders) {
    if (!order) {
      continue
    }

    try {
      await locking.execute(
        `manual-payment-capture:${order}`,
        async () => {
          const fresh = await loadPaymentCandidates(container, providers, order)

          for (const payment_id of selectPaymentsToCapture(fresh, settings)) {
            try {
              await flows.capturePaymentWorkflow(container).run({ input: { payment_id } })
            } catch (e) {
              logger.error(
                `manual-payment: capture failed for ${payment_id}`,
                e instanceof Error ? e : new Error(String(e)),
              )
            }
          }
        },
        { timeout: 30 },
      )
    } catch (e) {
      logger.error(`manual-payment: capture failed for order ${order}`, e instanceof Error ? e : new Error(String(e)))
    }
  }
}
