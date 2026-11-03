# Changelog

All notable changes to this project are documented in this file. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.0.0] - Unreleased

**Breaking:** the provider is now resolved from `@rokmohar/medusa-payment-manual/providers/manual`, the package must
also be listed in `plugins`, it needs a database migration (`npx medusa db:migrate`), and it requires Medusa 2.22.x and
Node.js 22.22 or newer. Unknown provider options are rejected at boot (only `type` is accepted). See
[Migrating from 1.x](./README.md#migrating-from-1x). Provider ids are unchanged, so existing orders keep working.

### Added

- Editable, translatable provider **Label** (Edit Provider in the admin, up to 100 characters). It names the provider in
  the admin list, breadcrumb and header card (which also gets a **Translate** action), and is returned as `label`
  (translated for the cart or order locale, `null` when unset) by the eligibility endpoint, the order payment
  endpoint and `getOrderPayment`.
- Translatable provider **Description** (Edit Provider in the admin, up to 500 characters): a short line under the
  payment method at checkout, returned as `description` (translated for the cart locale, `null` when unset) by the
  eligibility endpoint.
- `getProviderLabels(container, locale?)`: each provider's translated label by provider id, for staff notifications,
  invoices and admin lists.
- Provider order (`rank`): **Move Up** and **Move Down** on **Settings → Manual Payments** and
  `POST /admin/manual-payments/rank`. The eligibility endpoint and `GET /admin/manual-payments` return the providers
  sorted by rank (the checkout order).
- `listManualProviders(container)`: the registered manual providers with their `type`, `enabled` and `rank`, sorted
  by rank, for picking a provider in backend code.
- Provider `type` option (`bank_transfer`, `cash_on_delivery`, `invoice` or `other`, default `other`). It is stored in
  the payment data, returned by the admin and store endpoints, exported as `PaymentType`, `PAYMENT_TYPES` and
  `isPaymentType`, and shown in the admin, which hides the bank accounts, reference and QR settings for
  `cash_on_delivery`.
- Admin page **Settings → Manual Payments** and `/admin/manual-payments` API for per-provider settings, with an impact
  preview and confirmation before changes to capture mode or auto-cancel.
- Availability rules: countries, currencies and shipping options (each all, only selected, or all except selected),
  and minimum and maximum cart total. Unavailable providers are rejected with `manual_payment_not_allowed:<reason>`.
- **Enabled** setting per provider: a disabled provider is rejected for new checkouts with
  `manual_payment_not_allowed:disabled` (eligibility `reason: "disabled"`), and existing orders are unaffected.
- Payment fee, added to the cart as a line item without a variant, in the tax mode of the prices in its currency.
- The fee item is marked fulfilled when the order is placed, without creating a fulfillment, so the order's
  fulfillment status comes from the product fulfillments alone.
- Payment instructions, bank accounts per shipping country and payment references (`SI00`, `SI12`, `RF`). The reference
  is fixed when the order is placed; the bank accounts always reflect the current settings for the order's shipping
  country, so later changes show on existing orders too. A bank account's recipient address is structured, with
  Medusa's address field names (`address_1`, `postal_code`, `city`, `country_code`), as ISO 20022 payments expect.
- The fee label and the instructions are translatable with Medusa's translations (with the `translation` feature
  flag): a **Translate** action opens Medusa's translation editor. The fee title follows the cart's locale, and the
  order instructions follow the order's locale. The eligibility endpoint returns the translated `fee.label`.
- EPC and UPN QR payloads, and the `buildEpcPayload`, `buildUpnPayload` and `buildReference` helpers.
- Store endpoints `GET /store/manual-payments/eligibility` and `GET /store/manual-payments/orders/:id`.
- Capture on order or on delivery and auto-cancel of unpaid orders (hourly). A delivery captures right away on
  Medusa's `delivery.created` event, under a lock per order; the job that runs every minute is the fallback.
- Unit tests and a `test` script.
- License file, contributing guide, code of conduct, security policy, changelog, and issue and pull request templates.
- `homepage` and `bugs` fields in `package.json`.

### Changed

- Requires Medusa 2.22.x (`@medusajs/framework ~2.22.0`) and Node.js 22.22 or newer.
- The package is a Medusa plugin built with `medusa plugin:build`; the provider is exported from
  `providers/manual`.
- The provider accepts only the `type` option; any other option is rejected.
- Development dependencies updated to their latest versions compatible with Medusa 2.22. The plugin is built and
  type-checked against Medusa 2.22.2.
- Development moved to Yarn 4.
- README documents the provider id, enabling the provider in a region and using it from the storefront.

### Removed

- The provider's `getStatus` and `getPaymentData` methods.

## [1.1.0] - 2026-08-26

### Changed

- Requires Medusa 2.19.0 or newer: `@medusajs/framework` is now the only peer dependency, and imports moved to
  `@medusajs/framework/types` and `@medusajs/framework/utils`.
- Requires Node.js 20.19 or newer, or 22.12 or newer.
- The package declares `exports` and ships type declarations.

### Added

- `ManualProviderService` is exported from the package entry point.

## [1.0.3] - 2025-07-25

### Changed

- Updated package keywords.

## [1.0.2] - 2025-04-26

### Changed

- Republished from the same source as 1.0.1.

## [1.0.1] - 2025-02-14

### Added

- Support for Medusa 2.5.

## [0.1.4] - 2025-01-05

### Changed

- Updated Medusa dependencies.

## [0.1.3] - 2024-12-16

### Added

- Repository link in `package.json`.

## [0.1.2] - 2024-12-13

### Changed

- Removed an unused dependency and updated the README.

## [0.1.1] - 2024-12-13

### Added

- Manual payment provider for Medusa 2.

[Unreleased]: https://github.com/rokmohar/medusa-payment-manual/compare/v1.1.0...HEAD
[2.0.0]: https://github.com/rokmohar/medusa-payment-manual/compare/v1.1.0...v2.0.0
[1.1.0]: https://github.com/rokmohar/medusa-payment-manual/compare/v1.0.3...v1.1.0
[1.0.3]: https://github.com/rokmohar/medusa-payment-manual/compare/v1.0.2...v1.0.3
[1.0.2]: https://github.com/rokmohar/medusa-payment-manual/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/rokmohar/medusa-payment-manual/compare/v0.1.4...v1.0.1
[0.1.4]: https://github.com/rokmohar/medusa-payment-manual/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/rokmohar/medusa-payment-manual/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/rokmohar/medusa-payment-manual/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/rokmohar/medusa-payment-manual/releases/tag/v0.1.1
