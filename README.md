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

## ⚠️ MedusaJS v2.19.0 or newer

This plugin is only for MedusaJS v2.19.0 or newer.

If you are using an older version of MedusaJS, please use the [v1.0.3 version of this plugin](https://github.com/rokmohar/medusa-payment-manual/tree/v1.0.3).

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
