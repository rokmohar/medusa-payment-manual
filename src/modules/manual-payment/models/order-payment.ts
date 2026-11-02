import { model } from '@medusajs/framework/utils'

const ManualPaymentOrder = model.define('manual_payment_order', {
  id: model.id({ prefix: 'mpo' }).primaryKey(),
  order_id: model.text().unique(),
  provider_id: model.text(),
  reference: model.text().nullable(),
})

export default ManualPaymentOrder
