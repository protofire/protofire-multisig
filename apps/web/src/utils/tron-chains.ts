/**
 * Tron chain ids, kept free of tronweb imports so weight-sensitive modules
 * (e.g. utils/wallets.ts in the main bundle) can check the chain cheaply.
 * Single source of truth lives in @safe-global/utils (mirrors the Tron chain ids in the safe-deployments patch).
 */
import { TRON_CHAIN_IDS, isTronChain } from '@safe-global/utils/utils/chains'
import type { Chain } from '@safe-global/store/gateway/AUTO_GENERATED/chains'

export { TRON_CHAIN_IDS, isTronChain }

export const getTronChains = (configs: Chain[]): Chain[] => configs.filter((config) => isTronChain(config.chainId))

export const getTronChainIds = (configs: Chain[]): string[] => getTronChains(configs).map((config) => config.chainId)
