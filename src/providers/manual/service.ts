import crypto from 'crypto'
import {
  AuthorizePaymentInput,
  AuthorizePaymentOutput,
  CancelPaymentOutput,
  CapturePaymentOutput,
  DeletePaymentOutput,
  GetPaymentStatusInput,
  GetPaymentStatusOutput,
  InitiatePaymentOutput,
  MedusaContainer,
  RefundPaymentOutput,
  RetrievePaymentOutput,
  UpdatePaymentOutput,
  WebhookActionResult,
} from '@medusajs/framework/types'
import { AbstractPaymentProvider, PaymentActions, PaymentSessionStatus } from '@medusajs/framework/utils'
import { formatIssues } from '../../lib/parse'
import { type PaymentType, providerOptionsSchema } from '../../lib/payment-type'

export class ManualProviderService extends AbstractPaymentProvider {
  static override identifier = 'manual'

  static override validateOptions(options: Record<string, unknown> | undefined): void {
    const result = providerOptionsSchema.safeParse(options ?? {})

    if (result.success) {
      return
    }

    const unknownKeys = result.error.issues.some((i) => {
      return i.code === 'unrecognized_keys'
    })

    throw new Error(
      unknownKeys
        ? 'medusa-payment-manual: only the "type" provider option is supported, other settings moved to the admin'
        : `medusa-payment-manual: invalid provider options, ${formatIssues(result.error)}`,
    )
  }

  protected readonly type: PaymentType

  constructor(container: MedusaContainer, options?: Record<string, unknown>) {
    super(container, options)
    this.type = providerOptionsSchema.parse(options ?? {}).type ?? 'other'
  }

  // Medusa overwrites the session or payment data with whatever a method returns, so each one returns the type.
  private data() {
    return { type: this.type }
  }

  initiatePayment(): Promise<InitiatePaymentOutput> {
    return Promise.resolve({ data: this.data(), id: crypto.randomUUID() })
  }

  getPaymentStatus(_input?: GetPaymentStatusInput): Promise<GetPaymentStatusOutput> {
    return Promise.resolve({ status: PaymentSessionStatus.AUTHORIZED })
  }

  retrievePayment(): Promise<RetrievePaymentOutput> {
    return Promise.resolve({ data: this.data() })
  }

  authorizePayment(_input?: AuthorizePaymentInput): Promise<AuthorizePaymentOutput> {
    return Promise.resolve({ data: this.data(), status: PaymentSessionStatus.AUTHORIZED })
  }

  updatePayment(): Promise<UpdatePaymentOutput> {
    return Promise.resolve({ data: this.data() })
  }

  deletePayment(): Promise<DeletePaymentOutput> {
    return Promise.resolve({ data: this.data() })
  }

  capturePayment(): Promise<CapturePaymentOutput> {
    return Promise.resolve({ data: this.data() })
  }

  refundPayment(): Promise<RefundPaymentOutput> {
    return Promise.resolve({ data: this.data() })
  }

  cancelPayment(): Promise<CancelPaymentOutput> {
    return Promise.resolve({ data: this.data() })
  }

  getWebhookActionAndData(): Promise<WebhookActionResult> {
    return Promise.resolve({ action: PaymentActions.NOT_SUPPORTED })
  }
}

export default ManualProviderService
