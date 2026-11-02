# Changelog

All notable changes to this project are documented in this file. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Development dependencies updated to their latest versions compatible with Medusa 2.22. The plugin is built and
  type-checked against Medusa 2.22.2 and still supports Medusa 2.19.0 or newer.
- Development moved to Yarn 4.
- README documents the provider id, enabling the provider in a region and using it from the storefront.

### Added

- License file, contributing guide, code of conduct, security policy, changelog, and issue and pull request templates.
- `homepage` and `bugs` fields in `package.json`.

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
[1.1.0]: https://github.com/rokmohar/medusa-payment-manual/compare/v1.0.3...v1.1.0
[1.0.3]: https://github.com/rokmohar/medusa-payment-manual/compare/v1.0.2...v1.0.3
[1.0.2]: https://github.com/rokmohar/medusa-payment-manual/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/rokmohar/medusa-payment-manual/compare/v0.1.4...v1.0.1
[0.1.4]: https://github.com/rokmohar/medusa-payment-manual/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/rokmohar/medusa-payment-manual/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/rokmohar/medusa-payment-manual/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/rokmohar/medusa-payment-manual/releases/tag/v0.1.1
