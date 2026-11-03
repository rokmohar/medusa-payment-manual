import type { MedusaContainer } from '@medusajs/framework/types'
import { capturePaymentWorkflow } from '@medusajs/medusa/core-flows'
import { captureEligiblePayments, type CaptureFlows } from '../lib/capture'

// Fallback for the delivery.created subscriber (missed events) and the only trigger for on_order.
export const createCaptureJob = (flows: CaptureFlows = { capturePaymentWorkflow }) => {
  return async (container: MedusaContainer): Promise<void> => {
    await captureEligiblePayments(container, flows)
  }
}

export default createCaptureJob()

export const config = { name: 'manual-payment-capture', schedule: '* * * * *' }
