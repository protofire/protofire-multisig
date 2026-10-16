import type { Chain } from '@safe-global/store/gateway/AUTO_GENERATED/chains'

/**
 * `source` on `/migrate?source=` is the chain `shortName` of the dedicated deployment the
 * user is migrating from. It is accepted when it matches the `shortName` of a chain config
 * served by the gateway (dedicated deployments use the CGW short name, e.g. `chzmainnet`,
 * which can differ from the EIP-3770 one), so onboarding a dedicated deployment needs no
 * code change here.
 *
 * This is not a security boundary: the migration payload arrives via URL fragment and the
 * user confirms it explicitly. The check only keeps `/migrate` from rendering for garbage
 * ids, and `source` is never turned into a URL - the fallback sends users back to their
 * previous Safe UI themselves.
 */
export const isValidMigrationSource = (source: string | undefined, chains: Chain[]): source is string =>
  !!source && chains.some((chain) => chain.shortName === source)
