# Manual payment provider for Medusa

[![npm version](https://img.shields.io/npm/v/@rokmohar/medusa-payment-manual)](https://www.npmjs.com/package/@rokmohar/medusa-payment-manual)
[![CI](https://github.com/rokmohar/medusa-payment-manual/actions/workflows/ci.yml/badge.svg)](https://github.com/rokmohar/medusa-payment-manual/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

A payment provider for [Medusa 2](https://medusajs.com) for payments you collect outside Medusa, such as bank
transfer, cash on delivery or invoice. It does not contact a payment gateway: the payment session is authorized as soon
as the customer places the order, and you capture or refund the payment from the Medusa admin once the money arrives.

Registering it next to Medusa's built-in `pp_system_default` gives the payment its own provider id, so your
storefront and admin can tell these payments apart from other providers.

## Compatibility

| Plugin version | Medusa version  |
| -------------- | --------------- |
| 1.1.x          | 2.19.0 or newer |
| 1.0.x          | older than 2.19 |

Using an older Medusa version? Install the matching plugin version, for example
[v1.0.3](https://github.com/rokmohar/medusa-payment-manual/tree/v1.0.3):

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

Register the provider with the Payment Module in `medusa-config.ts`:

```ts
import { loadEnv, defineConfig } from '@medusajs/framework/utils'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

module.exports = defineConfig({
  // ... other config
  modules: [
    // ... other modules
    {
      resolve: '@medusajs/medusa/payment',
      options: {
        providers: [
          // ... other providers
          {
            resolve: '@rokmohar/medusa-payment-manual',
            id: 'manual',
          },
        ],
      },
    },
  ],
})
```

The provider takes no options.

## Usage

Medusa stores the provider as `pp_{identifier}_{id}`. With the configuration above, its id is `pp_manual_manual`.

1. In the Medusa admin, go to **Settings → Regions**, edit a region and add `pp_manual_manual` to its payment
   providers.
2. In your storefront, create the payment session with `provider_id: 'pp_manual_manual'`. With the
   [JS SDK](https://docs.medusajs.com/resources/js-sdk):

   ```ts
   await sdk.store.payment.initiatePaymentSession(cart, {
     provider_id: 'pp_manual_manual',
   })
   ```

3. When the payment arrives, capture it from the order page in the admin. Refunds are recorded the same way.

To offer several manual methods, such as bank transfer and cash on delivery, register the provider once per method with
a different `id` (for example `bank_transfer` → `pp_manual_bank_transfer`).

## Contributing

Bug reports and pull requests are welcome. Read the [contributing guide](./CONTRIBUTING.md) and the
[code of conduct](./CODE_OF_CONDUCT.md) first. Report security vulnerabilities privately as described in the
[security policy](./SECURITY.md).

## License

[MIT](./LICENSE) © Rok Mohar
