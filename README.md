# Manual payment provider for Medusa

[![npm version](https://img.shields.io/npm/v/@rokmohar/medusa-payment-manual)](https://www.npmjs.com/package/@rokmohar/medusa-payment-manual)
[![CI](https://github.com/rokmohar/medusa-payment-manual/actions/workflows/ci.yml/badge.svg)](https://github.com/rokmohar/medusa-payment-manual/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

A payment provider for [Medusa 2](https://medusajs.com) for payments you collect outside Medusa, such as bank
transfer, cash on delivery or invoice. It does not contact a payment gateway: the payment session is authorized as soon
as the customer places the order, and you capture or refund the payment from the Medusa admin once the money arrives.

Registering it next to Medusa's built-in `pp_system_default` gives the payment its own provider id, so your
storefront and admin can tell these payments apart from other providers.

Version 2 adds settings you manage in the Medusa admin, per provider: availability rules, a payment fee, payment
instructions, bank accounts, payment references, QR codes (EPC and UPN), automatic capture and automatic cancellation of
unpaid orders. **Everything is off by default.** A provider you have not configured behaves like 1.x: it is available
everywhere, you capture payments by hand, and it adds no fee, instructions, bank accounts, references or QR codes.

## Compatibility

| Plugin version | Medusa version  | Node.js |
| -------------- | --------------- | ------- |
| 2.x            | 2.22.x          | 22.22+  |
| 1.1.x          | 2.19 to 2.21    |         |
| 1.0.x          | older than 2.19 |         |

2.x declares `@medusajs/framework ~2.22.0` as a peer dependency. Using an older Medusa version? Install the matching
plugin version, for example [v1.0.3](https://github.com/rokmohar/medusa-payment-manual/tree/v1.0.3):

```bash
npm install @rokmohar/medusa-payment-manual@1.0.3
```

## Installation

```bash
npm install @rokmohar/medusa-payment-manual
```

Or with **yarn**:

```bash
yarn add @rokmohar/medusa-payment-manual
```

## Configuration

Add the package to `plugins` (it provides the admin page, the API routes, the jobs and the database module) and register
the provider with the Payment Module, using the `providers/manual` subpath:

```ts
import { loadEnv, defineConfig } from '@medusajs/framework/utils'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

module.exports = defineConfig({
  // ... other config
  plugins: [
    // ... other plugins
    { resolve: '@rokmohar/medusa-payment-manual', options: {} },
  ],
  modules: [
    // ... other modules
    {
      resolve: '@medusajs/medusa/payment',
      options: {
        providers: [
          // ... other providers
          {
            resolve: '@rokmohar/medusa-payment-manual/providers/manual',
            id: 'manual',
            options: { type: 'other' }, // optional, see "Provider type" below
          },
        ],
      },
    },
  ],
})
```

Then run the migrations, which create the plugin's tables:

```bash
npx medusa db:migrate
```

The provider's only option is `type` (see below). Any other option makes Medusa fail at boot; configure the provider in
the admin instead.

Medusa stores the provider as `pp_{identifier}_{id}`. With the configuration above, its id is `pp_manual_manual`. To offer
several manual methods, such as bank transfer and cash on delivery, register the provider once per method with a
different `id` (for example `bank_transfer` → `pp_manual_bank_transfer`). Each one has its own settings.

### Provider type

Declare what kind of payment a provider is with the `type` option, so your storefront and admin do not have to guess
it from the provider id:

```ts
{
  resolve: '@rokmohar/medusa-payment-manual/providers/manual',
  id: 'cashOnDelivery',
  options: { type: 'cash_on_delivery' },
}
```

| `type`             | Meaning                                                    |
| ------------------ | ---------------------------------------------------------- |
| `bank_transfer`    | The customer pays by bank transfer.                        |
| `cash_on_delivery` | The customer pays the courier or at pick-up.               |
| `invoice`          | The customer pays an invoice later.                        |
| `other`            | Anything else. This is the default when `type` is missing. |

An invalid `type` makes Medusa fail at boot. Where `type` shows up:

- **Payment data:** every provider method returns `{ type }` as its `data`, so Medusa stores it in the payment session
  and the payment (`payment.data.type`) and keeps it through authorize, capture, refund and cancel. A payment keeps the
  type it was created with if you change the option later.
- **Store API:** each provider in `GET /store/manual-payments/eligibility` has a `type`, and
  `GET /store/manual-payments/orders/:id` returns `payment.type` (from the payment data, else from the configuration).
- **Admin API:** `GET /admin/manual-payments` (sorted by rank, see [Order](#order)) and
  `GET /admin/manual-payments/:provider_id` return the `type`.
  Saved settings also carry their row `id` (`settings.id`), which stays the same across saves and is what
  translations reference.
- **TypeScript:** the package exports `PaymentType`, `PAYMENT_TYPES` and the type guard `isPaymentType`.
- **Backend code:** `getOrderPayment(container, orderId, locale?)` returns an order's payment instructions exactly as
  the store order endpoint does, for emails and documents: translated for the order's locale, else `locale`. It
  creates the order's snapshot if needed. `getProviderLabels(container, locale?)` returns each provider's label by
  provider id (translated for `locale`, `null` when none is set), one entry per provider with saved settings, for
  staff notifications, invoices and admin lists. `listManualProviders(container)` returns the registered manual
  providers as `{ provider_id, type, enabled, rank }`, sorted by rank (see [Order](#order)), for picking a provider
  in your own code: `enabled` is the plugin's **Enabled** setting (`true` while the provider has no saved settings).

The admin page adapts to the type. It shows the type in the provider list and on the provider page, and for
`cash_on_delivery` it hides the Bank Accounts section and the reference and QR code settings, which do not apply.
Settings you saved earlier stay as stored. `bank_transfer`, `invoice` and `other` show everything. The store order
endpoint follows the same rule: for `cash_on_delivery` it returns no bank accounts, `reference: null` and
`qr_type: 'none'`.

## Usage

1. In the Medusa admin, go to **Settings → Regions**, edit a region and add `pp_manual_manual` to its payment
   providers.
2. In your storefront, create the payment session with `provider_id: 'pp_manual_manual'`. With the
   [JS SDK](https://docs.medusajs.com/resources/js-sdk):

   ```ts
   await sdk.store.payment.initiatePaymentSession(cart, {
     provider_id: 'pp_manual_manual',
   })
   ```

3. When the payment arrives, capture it from the order page in the admin (or let the plugin capture it, see below).
   Refunds are recorded the same way.

## Admin settings

Go to **Settings → Manual Payments** in the admin. It lists every registered provider whose id starts with
`pp_manual_`, with its type, status, capture mode, countries and fee. Click a provider to open its page, which shows these
sections; edit one with **Edit** in its menu (bank accounts are added, edited, reordered and deleted one at a time):

- **Provider (header card):** the **Label**, a display name for the provider (up to 100 characters; blank uses the name
  derived from the provider id, for example "Bank Transfer"), the **Description**, a short line shown under the payment
  method at checkout (up to 500 characters), and **Enabled**. The label is the provider's name in the admin (list,
  breadcrumb and header) and in the store API (see [Eligibility](#eligibility)), which also returns the description.
- **Availability Rules:** countries (matched against the cart's **shipping** address), currencies (matched against
  the cart's currency) and shipping options (matched against the shipping method chosen in the cart), each with all,
  only selected, or all except selected; and the fee label. **Amounts** in the section's menu opens Medusa's price
  grid, like Edit Prices, with a row each for the minimum cart total, maximum cart total and payment fee and a column
  for each currency the saved currencies rule allows (blank means no limit or no fee; saving drops amounts for
  currencies the rule excludes, and so does saving a rule that excludes them). Amounts are in major units, for example
  `1.99`. The minimum and maximum totals exclude the plugin's own fee.
- **Payment Details:** the instructions shown to the customer, a reference template (`{display_id}` is the order
  number), the reference scheme (none, `SI00`, `SI12` or `RF`), the QR code type (none, EPC or UPN) and the UPN
  purpose code.
- **Bank Accounts:** one or more accounts (recipient, the recipient's address, postal code, city and country, IBAN, BIC
  and bank name). An account can be limited to shipping countries; an account with no countries is the default one.
- **Capture And Auto-Cancel:** the capture mode and automatic cancellation of unpaid orders.

Every setting is optional and applies only once you set it.

### Order

Each provider has a `rank`, its position in the list (`0` first; a provider without saved settings counts as `0`, and
equal ranks are ordered by provider id). Reorder the providers with **Move Up** and **Move Down** in a row's menu on
**Settings → Manual Payments**. The order is the checkout order: the eligibility endpoint, `GET /admin/manual-payments`
and `listManualProviders` return the providers sorted by it, so a storefront or backend code that picks a provider
automatically can take the first match.

`POST /admin/manual-payments/rank` with `{ "provider_ids": [...] }` sets the order through the API: the body must list
every registered manual provider exactly once (else `400`), each provider's rank becomes its index, and the response
is the sorted list, like `GET /admin/manual-payments`.

### Translations

The label, the description, the fee label and the instructions are translated with Medusa's own translations, like product titles. This needs
Medusa's `translation` feature flag (`MEDUSA_FF_TRANSLATION=true`, or `featureFlags: { translation: true }` in
`medusa-config.ts`) and the store's locales, which you add under **Settings → Translations**.

1. Save the provider's settings once. Until then the provider has no settings to translate, and **Translate** is
   disabled with a hint.
2. Choose **Translate** in the menu of the provider's header card, or of the **Availability Rules** or **Payment Details** section. It opens Medusa's
   translation editor for the provider's settings (`manual_payment_provider_setting`), where you enter the label, description,
   fee label and instructions per locale. The text you enter in the plugin's settings is the default, used for locales without
   a translation and when the flag is off.

The plugin uses the translation whose locale matches exactly, like Medusa (`sl-SI` doesn't use an `sl` translation). A
blank translation falls back to the default.

- **Fee title:** the fee line item is titled in the cart's locale, or the request's locale (Medusa's `?locale=`
  parameter or `x-medusa-locale` header) when the cart has none. Medusa translates only items with a variant, so the
  plugin re-titles the fee itself when the cart's locale changes (on `cart.updated`). Like Medusa, it doesn't
  re-title when the locale is removed. An order keeps the fee title it had when the cart was completed.
- **Label:** the eligibility endpoint returns it in the cart's locale (else the request's), and the store order endpoint
  and `getOrderPayment` in the order's locale (else the request's), like the instructions.
- **Description:** the eligibility endpoint returns it in the cart's locale (else the request's).
- **Instructions:** the store order endpoint and `getOrderPayment` return them in the order's locale (copied from the
  cart), or the request's locale when the order has none.

### Availability rules and the fee

When a payment session is created for an unavailable provider, or when the cart is completed after it became
unavailable, the request fails with an `INVALID_DATA` error whose message is `manual_payment_not_allowed:<reason>`. The
reason is one of `disabled`, `country`, `min_total`, `max_total`, `currency` or `shipping_option`.

Completing the cart also checks that its fee items are what the paying provider charges now: its one fee at the
configured amount, or none. They can differ when the fee setting changed after the session was created, or when a cart
change made Medusa delete the session while the fee item stayed. The plugin then corrects the fee items and fails with
`manual_payment_not_allowed:fee_changed`. The corrected total makes Medusa drop the session, so the customer chooses the
payment method again at the new total.

Countries, currencies and shipping options each take one of three modes: all (no restriction), only selected (the
cart's value must be listed) or all except selected (the cart's value must not be listed). A cart without a shipping
address fails both country modes. A cart without a shipping method yet fails "only selected shipping options" and
passes "all except selected shipping options"; the check runs again when the cart is completed. "Only selected" needs
at least one item; "all except" with none selected is the same as all.

**Enabled** is a plugin setting of each provider (⋯ → Edit on the provider's header card in the admin, on by default). Turn it off
to stop offering the provider for new checkouts: it fails the checks above with `manual_payment_not_allowed:disabled`,
and the eligibility endpoint returns `allowed: false` with `reason: "disabled"`. It doesn't affect existing orders,
which are still captured, auto-cancelled and shown by the store order endpoint. Medusa's own enabled flag is not used,
because the Payment Module resets it at every boot. Medusa's region assignment (which providers a region offers) still
applies on top.

The fee is added to the cart as a line item when the payment session is created, and replaced or removed when the
selected provider or the fee changes. It has **no variant or product**, its title is the fee label (default
`Payment Fee`) and its metadata has `manual_payment_fee` set to the provider id. Storefront and email code that
assumes every line item has a variant or product must handle it, for example:

```ts
const isFee = (item) => !!item.metadata?.manual_payment_fee
const products = cart.items.filter((item) => !isFee(item))
```

The fee is entered like your prices in that currency: tax-inclusive when the currency's prices include tax (the
currency's price preference, as Medusa applies it to a plain per-currency price), net otherwise. With tax-inclusive
prices in a currency a fee of `1.99` costs the customer `1.99`. The eligibility endpoint returns the amount
as configured.

The fee item doesn't require shipping, but Medusa still counts it as an item to fulfil. So when the order is placed
the plugin marks the fee fulfilled through the order module's `registerFulfillment`, which sets its fulfilled quantity
without creating a fulfillment. No fulfillment exists for the fee and nothing is sent to a fulfillment provider. The
order's fulfillment status (not fulfilled, fulfilled, shipped, delivered) comes from the product fulfillments alone,
and the admin's **Unfulfilled Items** lists only the products.

This runs on Medusa's `order.placed` event, under a lock per order, and never on canceled orders. A missed
`order.placed` is caught up by the order's next `order.fulfillment_created`. It fails, and logs the error, while the
order has an active order change (for example a requested order edit); the next fulfillment then catches up. Only the
fulfillment status is affected, never the payment.

The admin offers delivered items for returns and claims, so it doesn't offer the fee. A return of the fee is possible
through Medusa's API only. Capture on delivery doesn't wait for the fee, because one delivered fulfillment is enough.

### Capture and auto-cancel

The capture mode is one of:

- **manual** (default): you capture from the admin.
- **on order**: the payment is captured when the order is placed.
- **on delivery**: the payment is captured once the order has a delivered fulfillment.

Capture on delivery happens right away: when a fulfillment is marked as delivered (Medusa's `delivery.created` event),
the plugin captures that order's payments through Medusa's `capturePaymentWorkflow`. A job runs every minute and
captures what matches (this is how **on order** is captured, and the fallback for a missed delivery event). Both use the
same rules. They never capture a payment twice: each capture runs under a lock per order and is checked again inside
it, and payments that already have a capture or a refund, canceled payments, and draft, canceled and archived orders
are skipped. If you run several Medusa instances, use a shared locking provider (for example the Redis locking
provider) so the lock works across them.

Auto-cancel cancels unpaid orders after a number of days. A job runs hourly and cancels through Medusa's
`cancelOrderWorkflow`. It only cancels `pending` and `requires_action` orders, and it never touches an order that has a
fulfillment that isn't canceled, or a capture on any of its payments.

Both settings apply to **existing orders** on purpose: turning on capture mode or auto-cancel, or shortening the
auto-cancel days, affects open orders as well as new ones. Before you save such a change, the admin shows how many
orders will be captured or cancelled and asks you to confirm.

## Storefront endpoints

Both store endpoints need the usual publishable API key header.

### Eligibility

`GET /store/manual-payments/eligibility?cart_id=<cart id>` returns one entry for each enabled manual provider in the
cart's region, sorted by rank (see [Order](#order)), so the storefront can show them in that order and hide or explain
unavailable methods before the customer picks one:

```json
{
  "providers": [
    {
      "provider_id": "pp_manual_bank_transfer",
      "allowed": false,
      "reason": "min_total",
      "label": "Bank Transfer",
      "description": "Transfer to our bank account",
      "fee": { "amount": 1.5, "currency_code": "eur", "label": "Payment Fee" }
    }
  ]
}
```

`reason` is only present when `allowed` is `false`. `label` is the provider's label from the admin, translated for the
cart's locale (else the request's, see [Translations](#translations)), or `null` when none is set: fall back to your own
name for the provider then (for example from `type`). `description` is the short line to show under the payment
method, translated like `label`, or `null` when none is set. `fee` is `null` when the provider has no fee in the cart currency.
`fee.label` is the title the fee item gets, translated for the cart's locale (else the request's, see
[Translations](#translations)).

### Order payment instructions

`GET /store/manual-payments/orders/:id?locale=<locale>` returns what to show the customer after the order is placed.
`payment` is `null` when the order has no manual payment or the provider has no settings. `payment.label` is the provider's
label translated for the order's locale, or `null` when none is set (fall back to your own name).

```json
{
  "payment": {
    "provider_id": "pp_manual_bank_transfer",
    "label": "Bank Transfer",
    "instructions": "Pay within 7 days.",
    "amount": 41.5,
    "currency_code": "eur",
    "reference": "SI12 1234552",
    "qr_type": "upn",
    "bank_accounts": [
      {
        "id": "acc_1",
        "recipient": "Example d.o.o.",
        "address_1": "Slovenska cesta 1",
        "postal_code": "1000",
        "city": "Ljubljana",
        "country_code": "si",
        "iban": "SI56020360253863406",
        "bic": null,
        "bank_name": null,
        "qr": "UPNQR\n..."
      }
    ],
    "captured": false
  }
}
```

- `instructions` is translated for the order's locale, or the request's locale (Medusa's `?locale=` query parameter or
  `x-medusa-locale` header) when the order has none, and falls back to the default text (see
  [Translations](#translations)). It is `null` when there are no instructions.
- `reference` is generated once per order from the template and scheme when the order is placed, and stays the same
  afterwards, even when the template or scheme changes.
- `bank_accounts` holds the accounts for the order's shipping country, or the default account. They always reflect the
  current settings, so accounts you edit, add, delete or reorder later show on existing orders too.
- Each account's `address_1`, `postal_code`, `city` and `country_code` (ISO 3166-1 alpha-2, lowercase) are the
  recipient's address, with Medusa's address field names; each is `null` when not set.
- `qr` is the **payload text** of the QR code, not an image. It is `null` when `qr_type` is `none` or the payload can't
  be built (QR codes need EUR and a complete account).

Example storefront code:

```ts
const { providers } = await sdk.client.fetch<{ providers: { provider_id: string; allowed: boolean }[] }>(
  '/store/manual-payments/eligibility',
  { query: { cart_id: cart.id } },
)
const available = providers.filter((p) => p.allowed)

// after the order is placed
const { payment } = await sdk.client.fetch<{ payment: { instructions: string | null } | null }>(
  `/store/manual-payments/orders/${order.id}`,
  { query: { locale: 'sl' } },
)
```

### Rendering the QR code

Render the `qr` payload with a QR library. Both formats have fixed requirements:

| Type | Character set                   | Error correction | Other                                            |
| ---- | ------------------------------- | ---------------- | ------------------------------------------------ |
| EPC  | UTF-8                           | M                | At most 331 bytes                                |
| UPN  | ISO-8859-2, with ECI 000004 set | M                | QR version 15, byte mode, at most 411 characters |

EPC (the European Payments Council "Girocode"), with the [`qrcode`](https://www.npmjs.com/package/qrcode) package:

```ts
import QRCode from 'qrcode'

const svg = await QRCode.toString(account.qr, { type: 'svg', errorCorrectionLevel: 'M' })
```

UPN QR (Slovenia) must be encoded as ISO-8859-2 bytes, not UTF-8, so convert the payload first, for example with
[`iconv-lite`](https://www.npmjs.com/package/iconv-lite):

```ts
import iconv from 'iconv-lite'

const bytes = iconv.encode(account.qr, 'iso-8859-2')
// Render `bytes` as one byte-mode segment, QR version 15, error correction M, with ECI 000004.
```

Which QR library can take raw bytes and an ECI header differs, so see your library's docs for ECI support.

QR payloads are only built for EUR. In the UPN payload the purpose text is the payment reference; with no reference it uses model
`SI99` ("no reference").

## Migrating from 1.x

1. Change the provider's `resolve` to `@rokmohar/medusa-payment-manual/providers/manual`. Keep its `id`.
2. Add `@rokmohar/medusa-payment-manual` to `plugins`.
3. Remove any options you passed to the provider, except the new `type`. Other options are rejected at boot; the
   settings are in the admin now.
4. Run `npx medusa db:migrate`.

Provider ids (`pp_manual_<id>`) do not change, so existing orders, payments and region settings keep working. With no
settings saved, the provider behaves as it did in 1.x.

## Contributing

Bug reports and pull requests are welcome. Read the [contributing guide](./CONTRIBUTING.md) and the
[code of conduct](./CODE_OF_CONDUCT.md) first. Report security vulnerabilities privately as described in the
[security policy](./SECURITY.md).

## License

[MIT](./LICENSE) © Rok Mohar
