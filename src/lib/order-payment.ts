import type { MedusaContainer } from '@medusajs/framework/types'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import { z } from 'zod'
import { MANUAL_PAYMENT_MODULE } from '../modules/manual-payment'
import type ManualPaymentModuleService from '../modules/manual-payment/service'
import { toManualPaymentOrder, type ManualPaymentOrderDTO } from '../modules/manual-payment/mappers'
import { selectBankAccounts } from './accounts'
import { parseRow } from './parse'
import { buildQrPayload } from './qr'
import { isPaymentType, providerTypes, sectionsForType, type PaymentType } from './payment-type'
import { buildReference, schemeOfReference } from './reference'
import { isManualProviderId } from './settings'
import { translateSettings } from './translations'
import type { BankAccount, ProviderSettings, QrType } from './types'

export const ORDER_FIELDS = [
  'id',
  'display_id',
  'currency_code',
  'locale',
  'shipping_address.*',
  'payment_collections.payments.id',
  'payment_collections.payments.provider_id',
  'payment_collections.payments.amount',
  'payment_collections.payments.data',
  'payment_collections.payments.captured_at',
  'payment_collections.payments.canceled_at',
  'payment_collections.payments.captures.id',
]

const nullableStr = z.string().nullish()

const orderPaymentRowSchema = z.object({
  id: z.string(),
  provider_id: z.string(),
  amount: z.custom<unknown>((v) => {
    return v !== undefined && v !== null
  }, 'amount is required'),
  data: z.object({ type: z.unknown().optional() }).nullish().catch(undefined),
  captured_at: z.unknown().optional(),
  canceled_at: z.unknown().optional(),
  captures: z.array(z.unknown()).nullish(),
})

const orderSchema = z.object({
  id: z.string(),
  display_id: z.number().nullish(),
  currency_code: z.string(),
  locale: z.string().nullish(),
  shipping_address: z
    .object({
      first_name: nullableStr,
      last_name: nullableStr,
      address_1: nullableStr,
      address_2: nullableStr,
      postal_code: nullableStr,
      city: nullableStr,
      country_code: nullableStr,
    })
    .nullish(),
  payment_collections: z.array(z.object({ payments: z.array(orderPaymentRowSchema).nullish() })).nullish(),
})

export type OrderPaymentRow = z.output<typeof orderPaymentRowSchema>
export type OrderForPayment = z.output<typeof orderSchema>

export type OrderPaymentResponse = {
  provider_id: string
  type: PaymentType
  // The provider's label, translated for the order's locale; null when unset (clients fall back to their own name).
  label: string | null
  instructions: string | null
  amount: number
  currency_code: string
  reference: string | null
  qr_type: QrType
  bank_accounts: (Omit<BankAccount, 'countries'> & { qr: string | null })[]
  captured: boolean
}

export const findManualPayment = (order: OrderForPayment): OrderPaymentRow | null => {
  for (const pc of order.payment_collections ?? []) {
    for (const p of pc.payments ?? []) {
      if (!p.canceled_at && isManualProviderId(p.provider_id)) {
        return p
      }
    }
  }

  return null
}

const joinParts = (...parts: (string | null | undefined)[]): string | null => {
  return (
    parts
      .filter((p): p is string => {
        return !!p
      })
      .join(' ') || null
  )
}

export const buildOrderPaymentResponse = (
  order: OrderForPayment,
  settings: ProviderSettings | null,
  snapshot: ManualPaymentOrderDTO | null,
  configuredType: PaymentType = 'other',
): OrderPaymentResponse | null => {
  const payment = findManualPayment(order)

  if (!payment || !settings || !snapshot) {
    return null
  }

  const amount = Number(payment.amount)
  const a = order.shipping_address
  const name = joinParts(a?.first_name, a?.last_name)
  const payer = a ? { name, street: joinParts(a.address_1, a.address_2), city: joinParts(a.postal_code, a.city) } : null

  // The type stored in the payment data when it was authorized wins over today's config.
  const type = isPaymentType(payment.data?.type) ? payment.data.type : configuredType
  const shown = sectionsForType(type)
  // Accounts always come from the current settings; only the reference is fixed at placement.
  const accounts = shown.bankAccounts ? selectBankAccounts(settings.bank_accounts, a?.country_code ?? null) : []

  return {
    provider_id: payment.provider_id,
    type,
    label: settings.label,
    instructions: settings.instructions,
    amount,
    currency_code: order.currency_code,
    reference: shown.referenceAndQr ? snapshot.reference : null,
    qr_type: shown.referenceAndQr ? settings.qr_type : 'none',
    bank_accounts: accounts.map((account) => {
      const { countries: _countries, ...shownAccount } = account

      return {
        ...shownAccount,
        qr:
          !shown.referenceAndQr || settings.qr_type === 'none'
            ? null
            : buildQrPayload(settings.qr_type, {
                account,
                amount,
                currency_code: order.currency_code,
                reference: snapshot.reference,
                scheme: schemeOfReference(snapshot.reference),
                purpose_code: settings.upn_purpose_code,
                payer,
              }),
      }
    }),
    captured: !!payment.captured_at || !!payment.captures?.length,
  }
}

export const loadOrder = async (container: MedusaContainer, order_id: string): Promise<OrderForPayment | null> => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: 'order', fields: ORDER_FIELDS, filters: { id: order_id } })

  return data.length ? parseRow(orderSchema, data[0], `order ${order_id}`) : null
}

export const ensureOrderPayment = async (
  container: MedusaContainer,
  order_id: string,
  loaded?: OrderForPayment | null,
): Promise<ManualPaymentOrderDTO | null> => {
  const svc = container.resolve<ManualPaymentModuleService>(MANUAL_PAYMENT_MODULE)
  const read = async (): Promise<ManualPaymentOrderDTO | null> => {
    const row = (await svc.listManualPaymentOrders({ order_id })).at(0)

    return row ? toManualPaymentOrder(row) : null
  }
  const existing = await read()

  if (existing) {
    return existing
  }

  const order = loaded ?? (await loadOrder(container, order_id))
  const payment = order && findManualPayment(order)
  const settings = payment && (await svc.getSettings(payment.provider_id))

  if (!order || !payment || !settings) {
    return null
  }

  try {
    return toManualPaymentOrder(
      await svc.createManualPaymentOrders({
        order_id,
        provider_id: payment.provider_id,
        reference: buildReference(settings.reference_template, settings.reference_scheme, order.display_id ?? 0),
      }),
    )
  } catch (e) {
    // Lost a race on the unique order_id: the other writer's row wins.
    const raced = await read()

    if (raced) {
      return raced
    }

    throw e
  }
}

/**
 * The payment instructions for an order, exactly as `GET /store/manual-payments/orders/:id` returns them: type,
 * instructions translated for the order's locale (else `locale`), the reference fixed at placement, and the bank
 * accounts (with QR payloads) from the current settings for the order's shipping country. Creates the order's
 * snapshot if the `order.placed` subscriber hasn't yet. `undefined` when the order doesn't exist, `null` when it isn't
 * paid with a configured manual provider.
 */
export const getOrderPayment = async (
  container: MedusaContainer,
  order_id: string,
  locale?: string | null,
): Promise<OrderPaymentResponse | null | undefined> => {
  const order = await loadOrder(container, order_id)

  if (!order) {
    return undefined
  }

  const snapshot = await ensureOrderPayment(container, order.id, order)
  const provider_id = findManualPayment(order)?.provider_id
  const settings = provider_id
    ? await container.resolve<ManualPaymentModuleService>(MANUAL_PAYMENT_MODULE).getSettings(provider_id)
    : null
  const { label, instructions } = await translateSettings(container, settings, order.locale ?? locale)
  const configured = providerTypes(container.resolve(ContainerRegistrationKeys.CONFIG_MODULE))

  return buildOrderPaymentResponse(
    order,
    settings && { ...settings, label, instructions },
    snapshot,
    configured.get(provider_id ?? '') ?? 'other',
  )
}
