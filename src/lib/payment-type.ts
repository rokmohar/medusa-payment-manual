import { z } from 'zod'

export const PAYMENT_TYPES = ['bank_transfer', 'cash_on_delivery', 'invoice', 'other'] as const

export type PaymentType = (typeof PAYMENT_TYPES)[number]

export const paymentTypeSchema = z.enum(PAYMENT_TYPES)

export const isPaymentType = (value: unknown): value is PaymentType => {
  return paymentTypeSchema.safeParse(value).success
}

/** Provider options as written in medusa-config; `type` is optional and defaults to `other`. */
export const providerOptionsSchema = z.strictObject({ type: paymentTypeSchema.optional() })

const PROVIDER_PATH = '@rokmohar/medusa-payment-manual/providers/manual'

// `ConfigModule.modules` is an object keyed by module name once defineConfig has normalized the module array; the
// Payment Module entry holds the providers as `{ resolve, id, options }`.
const configSchema = z.object({
  modules: z.object({ payment: z.object({ options: z.object({ providers: z.array(z.unknown()) }) }) }),
})
const providerSchema = z.object({
  resolve: z.string(),
  id: z.string().min(1),
  options: providerOptionsSchema.optional().catch(undefined),
})

const isManualResolve = (resolve: string): boolean => {
  return resolve === PROVIDER_PATH || resolve.endsWith('/providers/manual')
}

/** Registered provider id (`pp_manual_<id>`) -> its configured `type`, for the manual providers in the Payment Module. */
export const providerTypes = (configModule: unknown): Map<string, PaymentType> => {
  const types = new Map<string, PaymentType>()
  const config = configSchema.safeParse(configModule)

  for (const entry of config.success ? config.data.modules.payment.options.providers : []) {
    const provider = providerSchema.safeParse(entry)

    if (provider.success && isManualResolve(provider.data.resolve)) {
      types.set(`pp_manual_${provider.data.id}`, provider.data.options?.type ?? 'other')
    }
  }

  return types
}

/** What a payment type uses: cash on delivery has no bank accounts, reference or QR code. Shared by the admin and the store. */
export const sectionsForType = (type: PaymentType): { bankAccounts: boolean; referenceAndQr: boolean } => {
  const cash = type === 'cash_on_delivery'

  return { bankAccounts: !cash, referenceAndQr: !cash }
}
