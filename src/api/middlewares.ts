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
import { cartIdOfPaymentCollection, currencyPricesIncludeTax, loadCartContext } from '../lib/cart-context'
import { FEE_METADATA_KEY, planFee } from '../lib/fee'
import { evaluateRules, isManualProviderId } from '../lib/rules'
import { translateSettings } from '../lib/translations'
import type { CartContext, ProviderSettings, StoredSettings } from '../lib/types'
import { MANUAL_PAYMENT_MODULE } from '../modules/manual-payment'
import type ManualPaymentModuleService from '../modules/manual-payment/service'
import { AdminRankManualProviders } from './admin/manual-payments/validators'

type Middleware = (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) => Promise<void>

const getSettings = async (req: MedusaRequest, provider_id: string): Promise<StoredSettings | null> => {
  return isManualProviderId(provider_id)
    ? await req.scope.resolve<ManualPaymentModuleService>(MANUAL_PAYMENT_MODULE).getSettings(provider_id)
    : null
}

const assertAllowed = (settings: ProviderSettings | null, cart: CartContext) => {
  const verdict = evaluateRules(settings, cart)

  if (!verdict.allowed) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, `manual_payment_not_allowed:${verdict.reason}`)
  }
}

// Read raw: core's body validator may or may not have run yet; an invalid body is left for it to reject.
const sessionBodySchema = z.object({ provider_id: z.string() })

// Runs before Medusa's handler, so createPaymentSessionsWorkflow sees the collection amount with the fee applied.
// Both workflows end in refreshPaymentCollectionForCartWorkflow, so no explicit refresh is needed.
export const guardPaymentSession = (flows = { addToCartWorkflow, deleteLineItemsWorkflow }): Middleware => {
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
    const { cart, locale, fee_items } = await loadCartContext(req.scope, cart_id)

    assertAllowed(settings, cart)

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

    next()
  }
}

// Re-checks the rules at completion: the cart may have changed since the session was created.
export const guardCartCompletion: Middleware = async (req, _res, next) => {
  const { cart, session_provider_ids } = await loadCartContext(req.scope, req.params.id)

  for (const provider_id of session_provider_ids) {
    assertAllowed(await getSettings(req, provider_id), cart)
  }

  next()
}

export default defineMiddlewares({
  routes: [
    {
      methods: ['POST'],
      matcher: '/store/payment-collections/:id/payment-sessions',
      middlewares: [guardPaymentSession()],
    },
    { methods: ['POST'], matcher: '/store/carts/:id/complete', middlewares: [guardCartCompletion] },
    {
      methods: ['POST'],
      matcher: '/admin/manual-payments/rank',
      middlewares: [validateAndTransformBody(AdminRankManualProviders)],
    },
  ],
})
