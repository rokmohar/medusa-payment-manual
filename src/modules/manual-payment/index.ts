import { Module } from '@medusajs/framework/utils'
import ManualPaymentModuleService from './service'

export const MANUAL_PAYMENT_MODULE = 'manual_payment'

export default Module(MANUAL_PAYMENT_MODULE, { service: ManualPaymentModuleService })
