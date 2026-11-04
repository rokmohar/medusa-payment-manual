import {
  defineMiddlewares,
  type MedusaNextFunction,
  type MedusaRequest,
  type MedusaResponse,
  validateAndTransformBody,
} from '@medusajs/framework/http'
import { MedusaError } from '@medusajs/framework/utils'
import { addToCartWorkflow, deleteLineItemsWorkflow } from '@medusajs/medusa/core-flows'
import { z } from 'zod'
import {
  cartIdOfPaymentCollection,
  currencyPricesIncludeTax,
  type LoadedCart,
  loadCartContext,
} from '../lib/cart-context'
import { FEE_METADATA_KEY, feeMatches, planFee } from '../lib/fee'
import { evaluateRules, isManualProviderId } from '../lib/rules'
import { translateSettings } from '../lib/translations'
import type { CartContext, ProviderSettings, RuleReason, StoredSettings } from '../lib/types'
import { MANUAL_PAYMENT_MODULE } from '../modules/manual-payment'
import type ManualPaymentModuleService from '../modules/manual-payment/service'
import { AdminRankManualProviders } from './admin/manual-payments/validators'

type Middleware = (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) => Promise<void>

const getSettings = async (req: MedusaRequest, provider_id: string): Promise<StoredSettings | null> => {
  return isManualProviderId(provider_id)
    ? await req.scope.resolve<ManualPaymentModuleService>(MANUAL_PAYMENT_MODULE).getSettings(provider_id)
    : null
}

type FeeFlows = { addToCartWorkflow: typeof addToCartWorkflow; deleteLineItemsWorkflow: typeof deleteLineItemsWorkflow }

const notAllowed = (reason: RuleReason | 'fee_changed') => {
  return new MedusaError(MedusaError.Types.INVALID_DATA, `manual_payment_not_allowed:${reason}`)
}

const assertAllowed = (settings: ProviderSettings | null, cart: CartContext) => {
  const verdict = evaluateRules(settings, cart)

  if (!verdict.allowed) {
    throw notAllowed(verdict.reason)
  }
}

// Brings the cart's fee items in line with what `provider_id` charges. Both workflows end in
// refreshPaymentCollectionForCartWorkflow, so the collection amount follows without an explicit refresh.
const syncFee = async (
  req: MedusaRequest,
  flows: FeeFlows,
  input: { cart_id: string; provider_id: string; settings: StoredSettings | null; loaded: LoadedCart },
) => {
  const { cart_id, provider_id, settings, loaded } = input
  const { cart, locale, fee_items } = loaded
  // The fee item is variant-less, so Medusa doesn't translate it: title it in the cart's locale here.
  const { fee_label } = await translateSettings(req.scope, settings, locale ?? req.locale)
  const plan = planFee({
    provider_id,
    currency_code: cart.currency_code,
    fee_items,
    settings: settings && { ...settings, fee_label },
  })

  if (plan.remove.length) {
    await flows.deleteLineItemsWorkflow(req.scope).run({ input: { cart_id, ids: plan.remove } })
  }

  if (plan.add) {
    await flows.addToCartWorkflow(req.scope).run({
      input: {
        cart_id,
        items: [
          {
            title: plan.add.title,
            unit_price: plan.add.amount,
            quantity: 1,
            requires_shipping: false,
            is_discountable: false,
            // Variant-less items default to tax-exclusive; enter the fee like the prices in its currency.
            is_tax_inclusive: await currencyPricesIncludeTax(req.scope, cart.currency_code),
            metadata: { [FEE_METADATA_KEY]: provider_id },
          },
        ],
      },
    })
  }
}

// Read raw: core's body validator may or may not have run yet; an invalid body is left for it to reject.
const sessionBodySchema = z.object({ provider_id: z.string() })

// Runs before Medusa's handler, so createPaymentSessionsWorkflow sees the collection amount with the fee applied.
export const guardPaymentSession = (flows: FeeFlows = { addToCartWorkflow, deleteLineItemsWorkflow }): Middleware => {
  return async (req, _res, next) => {
    const body = sessionBodySchema.safeParse(req.body)

    if (!body.success) {
      return next()
    }

    const cart_id = await cartIdOfPaymentCollection(req.scope, req.params.id)

    if (!cart_id) {
      return next()
    }

    const { provider_id } = body.data
    const settings = await getSettings(req, provider_id)
    const loaded = await loadCartContext(req.scope, cart_id)

    assertAllowed(settings, loaded.cart)
    await syncFee(req, flows, { cart_id, provider_id, settings, loaded })

    next()
  }
}

/**
 * Re-checks the rules at completion: the cart may have changed since the session was created. The fee items must also
 * match what the paying provider charges now (the fee setting changed, or the fee item was removed while the session
 * was being created); otherwise they are corrected, which changes the cart total, so Medusa drops the stale session
 * and the customer confirms the payment method again at the corrected total.
 */
export const guardCartCompletion = (flows: FeeFlows = { addToCartWorkflow, deleteLineItemsWorkflow }): Middleware => {
  return async (req, _res, next) => {
    const cart_id = req.params.id
    const loaded = await loadCartContext(req.scope, cart_id)
    const { cart, fee_items, session_provider_ids } = loaded

    for (const provider_id of session_provider_ids) {
      assertAllowed(await getSettings(req, provider_id), cart)
    }

    // ponytail: with several sessions the paying one is ambiguous, so the fee is checked for a single session only
    const [provider_id, ...others] = session_provider_ids

    if (provider_id && !others.length) {
      const settings = await getSettings(req, provider_id)

      if (!feeMatches({ provider_id, currency_code: cart.currency_code, fee_items, settings })) {
        await syncFee(req, flows, { cart_id, provider_id, settings, loaded })

        throw notAllowed('fee_changed')
      }
    }

    next()
  }
}

export default defineMiddlewares({
  routes: [
    {
      methods: ['POST'],
      matcher: '/store/payment-collections/:id/payment-sessions',
      middlewares: [guardPaymentSession()],
    },
    { methods: ['POST'], matcher: '/store/carts/:id/complete', middlewares: [guardCartCompletion()] },
    {
      methods: ['POST'],
      matcher: '/admin/manual-payments/rank',
      middlewares: [validateAndTransformBody(AdminRankManualProviders)],
    },
  ],
})
