export const PROTOFIRE_MULTISIG_URL = 'https://app.safe.protofire.io'

// Immutable zkEVM mainnet only - the testnet deployment keeps running without the banner
export const DATA_MIGRATION_BANNER_CHAIN_IDS = ['13371']

export const isDataMigrationBannerChain = (chainId: string): boolean =>
  DATA_MIGRATION_BANNER_CHAIN_IDS.includes(chainId)

export const getProtofireMultisigSafeUrl = (shortName: string, safeAddress: string): string =>
  `${PROTOFIRE_MULTISIG_URL}/home?safe=${encodeURIComponent(shortName)}:${safeAddress}`

export const DATA_MIGRATION_BANNER = {
  title: 'Immutable Safe is moving to Protofire Multisig.',
  description:
    'This interface will be discontinued on November 30, 2026. Your Safes stay on-chain and are already available on Protofire Multisig.',
  cta: 'Open in Protofire Multisig →',
}
