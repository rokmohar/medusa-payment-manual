# Manual payment for MedusaJS v2

## Installation

Run the following command to install the plugin with **npm**:

```bash
npm install --save @rokmohar/medusa-payment-manual
```

Or with **yarn**:

```bash
yarn add @rokmohar/medusa-payment-manual
```

## ⚠️ MedusaJS v2.5.0 or newer

This plugin is only for MedusaJS v2.5.0 or newer.

If you are using MedusaJS v2.4.0 or older, please use the [older version of this plugin](https://github.com/rokmohar/medusa-payment-manual/tree/v0.1.4).

## Configuration

Add the plugin to your `medusa-config.ts` file:

```js
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
