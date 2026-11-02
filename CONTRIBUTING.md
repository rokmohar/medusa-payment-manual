# Contributing

Thanks for helping improve the manual payment provider for Medusa. Bug reports, documentation fixes and pull requests
are all welcome. By taking part you agree to follow the [code of conduct](./CODE_OF_CONDUCT.md).

## Reporting issues

- **Bugs and feature requests:** open an [issue](https://github.com/rokmohar/medusa-payment-manual/issues/new/choose) using one of the templates. Include the plugin,
  Medusa and Node versions.
- **Security vulnerabilities:** do not open a public issue. Follow the [security policy](./SECURITY.md).

## Development setup

Prerequisites:

- Node.js 22.22 or newer
- Yarn 4, enabled through Corepack: `corepack enable`

```bash
git clone https://github.com/rokmohar/medusa-payment-manual.git
cd medusa-payment-manual
yarn install
```

| Command          | What it does                    |
| ---------------- | ------------------------------- |
| `yarn build`     | Compiles `src` into `dist`      |
| `yarn watch`     | Recompiles on change            |
| `yarn lint`      | Lints `src` with ESLint         |
| `yarn typecheck` | Type-checks the plugin          |
| `yarn format`    | Checks formatting with Prettier |

CI runs `format`, `lint`, `typecheck` and `build` on pushes to and pull requests against `main`; run them before
you open one. `yarn format:fix` and `yarn lint:fix` fix most findings.

## Trying changes in a Medusa app

Build the plugin and pack it into a tarball:

```bash
yarn build
npm pack
```

Then install the tarball in your Medusa application, for example
`npm install /path/to/rokmohar-medusa-payment-manual-<version>.tgz`, and register the provider as described in the
[README](./README.md#configuration).

## Pull requests

1. Fork the repository and branch off `main`.
2. Keep each pull request to one change.
3. Update the [README](./README.md) when you change something users see, and add an entry under `Unreleased` in
   [CHANGELOG.md](./CHANGELOG.md).
4. Write commit messages in the [Conventional Commits](https://www.conventionalcommits.org/) style: `feat:`, `fix:`,
   `docs:`, `chore:`, `ci:`.
5. Open the pull request against `main` and fill in the template.

## Releases

Releases are published by the maintainer with the manual **Publish** workflow. It builds the package, publishes it to
npm through trusted publishing, tags the commit and creates the GitHub release. Before running it, bump `version` in
`package.json` and date the version's section in the changelog.
