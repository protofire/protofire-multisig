import { getExplorerLink } from '@safe-global/utils/utils/gateway'
import type { SafeVersion } from '@safe-global/types-kit'
import { getSafeSingletonDeployment } from '@safe-global/safe-deployments'
import semverSatisfies from 'semver/functions/satisfies'
import { LATEST_SAFE_VERSION } from '@safe-global/utils/config/constants'
import type { Chain } from '@safe-global/store/gateway/AUTO_GENERATED/chains'

export enum FEATURES {
  ERC721 = 'ERC721',
  SAFE_APPS = 'SAFE_APPS',
  DOMAIN_LOOKUP = 'DOMAIN_LOOKUP',
  SPENDING_LIMIT = 'SPENDING_LIMIT',
  EIP1559 = 'EIP1559',
  SAFE_TX_GAS_OPTIONAL = 'SAFE_TX_GAS_OPTIONAL',
  TX_SIMULATION = 'TX_SIMULATION',
  DEFAULT_TOKENLIST = 'DEFAULT_TOKENLIST',
  RELAYING = 'RELAYING',
  EIP1271 = 'EIP1271',
  RISK_MITIGATION = 'RISK_MITIGATION',
  TRON = 'TRON',
  PUSH_NOTIFICATIONS = 'PUSH_NOTIFICATIONS',
  NATIVE_WALLETCONNECT = 'NATIVE_WALLETCONNECT',
  RECOVERY = 'RECOVERY',
  COUNTERFACTUAL = 'COUNTERFACTUAL',
  DELETE_TX = 'DELETE_TX',
  SPEED_UP_TX = 'SPEED_UP_TX',
  SAP_BANNER = 'SAP_BANNER',
  NATIVE_SWAPS = 'NATIVE_SWAPS',
  NATIVE_SWAPS_USE_COW_STAGING_SERVER = 'NATIVE_SWAPS_USE_COW_STAGING_SERVER',
  NATIVE_SWAPS_FEE_ENABLED = 'NATIVE_SWAPS_FEE_ENABLED',
  NATIVE_SWAPS_COW = 'NATIVE_SWAPS_COW',
  ZODIAC_ROLES = 'ZODIAC_ROLES',
  STAKING = 'STAKING',
  STAKING_PROMO = 'STAKING_PROMO',
  MULTI_CHAIN_SAFE_CREATION = 'MULTI_CHAIN_SAFE_CREATION',
  MULTI_CHAIN_SAFE_ADD_NETWORK = 'MULTI_CHAIN_SAFE_ADD_NETWORK',
  PROPOSERS = 'PROPOSERS',
  TARGETED_SURVEY = 'TARGETED_SURVEY',
  BRIDGE = 'BRIDGE',
  RENEW_NOTIFICATIONS_TOKEN = 'RENEW_NOTIFICATIONS_TOKEN',
  TX_NOTES = 'TX_NOTES',
  NESTED_SAFES = 'NESTED_SAFES',
  MASS_PAYOUTS = 'MASS_PAYOUTS',
  SPACES = 'SPACES',
  EARN = 'EARN',
  EARN_PROMO = 'EARN_PROMO',
  MIXPANEL = 'MIXPANEL',
  NATIVE_SWAPS_LIFI = 'NATIVE_SWAPS_LIFI',
  HIDE_NATIVE_TOKEN = 'HIDE_NATIVE_TOKEN',
  TEMPO_GAS_TOKEN = 'TEMPO_GAS_TOKEN',
  OZ_SAFE_UTILS = 'OZ_SAFE_UTILS',
  PROTOFIRE_FORK_OZ_SAFE_UTILS = 'PROTOFIRE_FORK_OZ_SAFE_UTILS',
  POSITIONS = 'POSITIONS',
  PORTFOLIO_ENDPOINT = 'PORTFOLIO_ENDPOINT',
  NATIVE_COW_SWAP_FEE_V2 = 'NATIVE_COW_SWAP_FEE_V2',
  CSV_TX_EXPORT = 'CSV_TX_EXPORT',
  SAFE_LABS_TERMS_DISABLED = 'SAFE_LABS_TERMS_DISABLED',
  NO_FEE_NOVEMBER = 'NO_FEE_NOVEMBER',
  HYPERNATIVE = 'HYPERNATIVE',
  HYPERNATIVE_RELAX_GUARD_CHECK = 'HYPERNATIVE_RELAX_GUARD_CHECK',
  HYPERNATIVE_QUEUE_SCAN = 'HYPERNATIVE_QUEUE_SCAN',
  EURCV_BOOST = 'EURCV_BOOST',
  MY_ACCOUNTS = 'MY_ACCOUNTS',
  SUNSET_BANNER = 'SUNSET_BANNER',
  ERC7730_ERC8176_CLEAR_SIGNING = 'ERC7730_ERC8176_CLEAR_SIGNING',
  PAY_FROM_SAFE = 'PAY_FROM_SAFE', // pay the network fee from the Safe in a stablecoin via our relayer (feature 023)
  NEW_NETWORK = 'NEW_NETWORK',
  OASIS_SIGNED_ETH_CALL_GAS_ESTIMATION = 'OASIS_SIGNED_ETH_CALL_GAS_ESTIMATION', // Oasis Sapphire: validate transactions via signed eth_call
  HEDERA = 'HEDERA',
}

const MIN_SAFE_VERSION = '1.3.0'

export const hasFeature = (chain: Pick<Chain, 'features'>, feature: FEATURES): boolean => {
  return (chain.features as string[]).includes(feature)
}

// Tron block explorers don't accept 0x-prefixed hashes/addresses
// Kept in sync with the chain ids covered by apps/web/tron-deployments.json (mainnet, Shasta).
// Nile testnet (3448148188) is deliberately excluded: it has no deployment addresses there yet.
export const TRON_CHAIN_IDS: ReadonlySet<string> = new Set(['2494104990', '728126428'])

export const isTronChain = (chainId: string): boolean => TRON_CHAIN_IDS.has(chainId)

export const getBlockExplorerLink = (
  chain: Pick<Chain, 'blockExplorerUriTemplate' | 'chainId'>,
  address: string,
): { href: string; title: string } | undefined => {
  if (chain.blockExplorerUriTemplate) {
    const hash = TRON_CHAIN_IDS.has(chain.chainId) ? address.replace(/^0x/, '') : address
    return getExplorerLink(hash, chain.blockExplorerUriTemplate)
  }
}
/** This version is used if a network does not have the LATEST_SAFE_VERSION deployed yet */
const FALLBACK_SAFE_VERSION = '1.3.0' as const
export const getLatestSafeVersion = (
  chain: Pick<Chain, 'recommendedMasterCopyVersion' | 'chainId'> | undefined,
): SafeVersion => {
  const latestSafeVersion = chain?.recommendedMasterCopyVersion || LATEST_SAFE_VERSION

  // Without version filter it will always return the LATEST_SAFE_VERSION constant to avoid automatically updating to the newest version if the deployments change
  const latestDeploymentVersion = (getSafeSingletonDeployment({ network: chain?.chainId, released: true })?.version ??
    FALLBACK_SAFE_VERSION) as SafeVersion

  // The version needs to be smaller or equal to the
  if (semverSatisfies(latestDeploymentVersion, `<=${latestSafeVersion}`)) {
    return latestDeploymentVersion
  } else {
    return latestSafeVersion as SafeVersion
  }
}

export const isNonCriticalUpdate = (version?: string | null) => {
  return version && semverSatisfies(version, `>= ${MIN_SAFE_VERSION}`)
}
