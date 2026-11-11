# <picture><source media="(prefers-color-scheme: dark)" srcset="./.github/assets/logo-dark.svg"><img src="./.github/assets/logo-light.svg" height="60" valign="middle" alt="Protofire Multisig" /></picture>

# Protofire Multisig

Protofire Multisig is a web interface for multi-signature smart contract wallets, maintained by Protofire.

## Origin and independence

This project is a modified version of [safe-global/safe-wallet-monorepo](https://github.com/safe-global/safe-wallet-monorepo), based on commit [6d26ba8](https://github.com/safe-global/safe-wallet-monorepo/commit/6d26ba8) (following release v1.83.3).

This is not the official Safe{Wallet}. It is not affiliated with, endorsed by, or sponsored by Safe Ecosystem Foundation, Safe Labs, or any other Safe entity. "Safe" and "Safe{Wallet}" are trademarks of their respective owners and are used here only to identify the upstream project.

## Modifications

This project has been modified by Protofire (2026). Changes are recorded in the [commit history](https://github.com/protofire/protofire-multisig/commits/production-multisig).

## License

Licensed under the GNU General Public License v3.0. See the [LICENSE](./LICENSE) file in the root of this repository. Upstream copyright and license notices are retained.

## Repository structure

- `apps/web` - Next.js web application
- `packages/store` - shared Redux store
- `packages/utils` - shared utilities and TypeScript types
- `config/` - shared configuration

More details on the web app and its environment setup: [apps/web/README.md](./apps/web/README.md).

## Getting started

### Prerequisites

- Node.js, latest stable
- Yarn 4.5.3 or later

Enable Yarn via Corepack:

```bash
corepack enable
yarn
```

### Setup

```bash
git clone https://github.com/protofire/protofire-multisig.git
cd protofire-multisig
git checkout production-multisig
yarn install
```

### Quick start

```bash
# run the web app in dev mode
yarn workspace @safe-global/web dev

# web unit tests
yarn workspace @safe-global/web test

# Storybook
yarn workspace @safe-global/web storybook
```

## Monorepo commands

### Workspaces

```bash
yarn workspace <workspace-name> <script>
yarn workspace <workspace-name> add <package-name>
yarn workspace <workspace-name> remove <package-name>
```

### Lint, format, type-check

```bash
yarn lint
yarn prettier
yarn workspace @safe-global/web type-check
```

### Tests

```bash
# unit tests
yarn test

# Cypress E2E, interactive
yarn workspace @safe-global/web cypress:open

# Cypress E2E, headless
yarn workspace @safe-global/web cypress:run
```

## Tooling

- Husky - pre-commit hooks for lint, format and type-check
- ESLint and Prettier - code style
- Jest - unit tests
- Cypress - E2E tests for the web app
- Storybook - component development for the web app
- Next.js - web framework

## Contributing

Before pushing, make sure type-check, lint, prettier and tests pass. Use semantic commit messages.

## Useful links

- [Upstream Safe developer docs](https://docs.safe.global/) - refer to the upstream project, not to Protofire Multisig
- [Yarn Workspaces](https://yarnpkg.com/features/workspaces)
- [Next.js](https://nextjs.org/docs)
- [Storybook](https://storybook.js.org/docs)
- [Jest](https://jestjs.io/)
