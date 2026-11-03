import type { MedusaRequest, MedusaResponse } from '@medusajs/framework'
import { MedusaError } from '@medusajs/framework/utils'
import { getOrderPayment, type OrderPaymentResponse } from '../../../../../lib/order-payment'

export async function GET(req: MedusaRequest, res: MedusaResponse<{ payment: OrderPaymentResponse | null }>) {
  // Medusa's store middleware moves ?locale= / x-medusa-locale to req.locale and deletes the query value.
  const locale = req.locale ?? (typeof req.query.locale === 'string' ? req.query.locale : null)
  const payment = await getOrderPayment(req.scope, req.params.id, locale)

  if (payment === undefined) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Order ${req.params.id} not found`)
  }

  res.json({ payment })
}
