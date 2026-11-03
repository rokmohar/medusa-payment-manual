import type { MedusaRequest, MedusaResponse } from '@medusajs/framework'
import { ContainerRegistrationKeys, MedusaError } from '@medusajs/framework/utils'
import { z } from 'zod'
import { loadCartContext } from '../../../../lib/cart-context'
import { feeAmount, feeTitle } from '../../../../lib/fee'
import { parseRow } from '../../../../lib/parse'
import { type PaymentType, providerTypes } from '../../../../lib/payment-type'
import { sortByRank } from '../../../../lib/providers'
import { evaluateRules, isManualProviderId } from '../../../../lib/rules'
import { translateSettings } from '../../../../lib/translations'
import type { RuleReason } from '../../../../lib/types'
import { MANUAL_PAYMENT_MODULE } from '../../../../modules/manual-payment'
import type ManualPaymentModuleService from '../../../../modules/manual-payment/service'

// Providers are sorted by rank (the checkout order).
export type EligibilityResponse = {
  providers: {
    provider_id: string
    type: PaymentType
    allowed: boolean
    reason?: RuleReason
    // The provider's label, translated for the cart's locale (else the request's); null when unset: fall back to your own name.
    label: string | null
    // Short line under the payment method at checkout, translated like `label`; null when unset.
    description: string | null
    // `fee.label` is the fee line item title, translated for the cart's locale (else the request's).
    fee: { amount: number; currency_code: string; label: string } | null
  }[]
}

// `region.payment_providers` is the region_payment_provider link's field alias.
const regionSchema = z.object({
  payment_providers: z.array(z.object({ id: z.string(), is_enabled: z.boolean() })).nullish(),
})

const listRegionManualProviders = async (req: MedusaRequest, region_id: string | null): Promise<string[]> => {
  if (!region_id) {
    return []
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: 'region',
    fields: ['payment_providers.id', 'payment_providers.is_enabled'],
    filters: { id: region_id },
  })
  const region = data.length ? parseRow(regionSchema, data[0], `region ${region_id}`) : null

  return (region?.payment_providers ?? [])
    .filter((p) => {
      return p.is_enabled && isManualProviderId(p.id)
    })
    .map((p) => {
      return p.id
    })
}

export async function GET(req: MedusaRequest, res: MedusaResponse<EligibilityResponse>) {
  const cart_id = req.query.cart_id

  if (typeof cart_id !== 'string' || !cart_id) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, 'cart_id is required')
  }

  const { cart, region_id, locale } = await loadCartContext(req.scope, cart_id)
  const provider_ids = await listRegionManualProviders(req, region_id)
  const types = providerTypes(req.scope.resolve(ContainerRegistrationKeys.CONFIG_MODULE))
  const all = await req.scope.resolve<ManualPaymentModuleService>(MANUAL_PAYMENT_MODULE).listSettings()

  const providers = provider_ids.map(async (provider_id) => {
    const settings =
      all.find((s) => {
        return s.provider_id === provider_id
      }) ?? null
    const verdict = evaluateRules(settings, cart)
    const translated = await translateSettings(req.scope, settings, locale ?? req.locale)
    const amount = feeAmount(settings, cart.currency_code)
    const fee =
      amount === null
        ? null
        : {
            amount,
            currency_code: cart.currency_code,
            label: feeTitle(translated.fee_label),
          }

    return {
      provider_id,
      type: types.get(provider_id) ?? 'other',
      allowed: verdict.allowed,
      ...(verdict.allowed ? {} : { reason: verdict.reason }),
      label: translated.label,
      description: translated.description,
      fee,
    }
  })

  res.json({ providers: sortByRank(await Promise.all(providers), all) })
}
