import { MedusaContainer, PaymentProviderError, PaymentProviderSessionResponse, WebhookActionResult } from '@medusajs/types'
import { AbstractPaymentProvider, PaymentActions, PaymentSessionStatus } from '@medusajs/utils'

type ManualOptions = any

export class ManualProviderService extends AbstractPaymentProvider<ManualOptions> {
  static identifier = 'manual'

  protected readonly options_: ManualOptions
  protected container_: Record<string, unknown>

  constructor(container: MedusaContainer, options: ManualOptions) {
    super(container, options)

    this.container_ = container
    this.options_ = options
  }

  async getStatus(): Promise<string> {
    return 'authorized'
  }

  async getPaymentData(): Promise<Record<string, unknown>> {
    return {}
  }

  async initiatePayment(): Promise<PaymentProviderSessionResponse> {
    return { data: {} }
  }

  async getPaymentStatus(): Promise<PaymentSessionStatus> {
    throw new Error('Method not implemented.')
  }

  async retrievePayment(): Promise<Record<string, unknown> | PaymentProviderError> {
    return {}
  }

  async authorizePayment(): Promise<
    | PaymentProviderError
    | {
        status: PaymentSessionStatus
        data: PaymentProviderSessionResponse['data']
      }
  > {
    return { data: {}, status: PaymentSessionStatus.AUTHORIZED }
  }

  async updatePayment(): Promise<PaymentProviderError | PaymentProviderSessionResponse> {
    return { data: {} } as PaymentProviderSessionResponse
  }

  async deletePayment(): Promise<Record<string, unknown>> {
    return {}
  }

  async capturePayment(): Promise<Record<string, unknown>> {
    return {}
  }

  async refundPayment(): Promise<Record<string, unknown>> {
    return {}
  }

  async cancelPayment(): Promise<Record<string, unknown>> {
    return {}
  }

  async getWebhookActionAndData(): Promise<WebhookActionResult> {
    return { action: PaymentActions.NOT_SUPPORTED }
  }
}

export default ManualProviderService
