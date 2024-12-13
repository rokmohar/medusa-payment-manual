# medusa-payment-manual

## Installation

Run the following command to install the plugin with **npm**:

```bash
npm install --save @rokmohar/medusa-payment-manual
```

Or with **yarn**:

```bash
yarn add @rokmohar/medusa-payment-manual
```

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
