import crypto from 'crypto'
import {
  AuthorizePaymentOutput,
  CancelPaymentOutput,
  CapturePaymentOutput,
  DeletePaymentOutput,
  GetPaymentStatusOutput,
  InitiatePaymentOutput,
  MedusaContainer,
  RefundPaymentOutput,
  RetrievePaymentOutput,
  UpdatePaymentOutput,
  WebhookActionResult,
} from '@medusajs/types'
import { AbstractPaymentProvider, PaymentActions, PaymentSessionStatus } from '@medusajs/utils'

type ManualOptions = Record<string, any>

export class ManualProviderService extends AbstractPaymentProvider {
  static identifier = 'manual'

  protected options: ManualOptions

  constructor(container: MedusaContainer, options: ManualOptions) {
    super(container, options)
    this.options = options
  }

  async getStatus(): Promise<string> {
    return 'authorized'
  }

  async getPaymentData(): Promise<Record<string, unknown>> {
    return {}
  }

  async initiatePayment(): Promise<InitiatePaymentOutput> {
    return { data: {}, id: crypto.randomUUID() }
  }

  async getPaymentStatus(): Promise<GetPaymentStatusOutput> {
    throw new Error('Method not implemented.')
  }

  async retrievePayment(): Promise<RetrievePaymentOutput> {
    return {}
  }

  async authorizePayment(): Promise<AuthorizePaymentOutput> {
    return { data: {}, status: PaymentSessionStatus.AUTHORIZED }
  }

  async updatePayment(): Promise<UpdatePaymentOutput> {
    return { data: {} }
  }

  async deletePayment(): Promise<DeletePaymentOutput> {
    return { data: {} }
  }

  async capturePayment(): Promise<CapturePaymentOutput> {
    return { data: {} }
  }

  async refundPayment(): Promise<RefundPaymentOutput> {
    return { data: {} }
  }

  async cancelPayment(): Promise<CancelPaymentOutput> {
    return { data: {} }
  }

  async getWebhookActionAndData(): Promise<WebhookActionResult> {
    return { action: PaymentActions.NOT_SUPPORTED }
  }
}

export default ManualProviderService
