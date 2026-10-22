// Dependency-light on purpose: imported by the firebase-messaging service worker too
import type { Chain } from '@safe-global/store/gateway/AUTO_GENERATED/chains'
import type { FEATURES } from '@safe-global/utils/utils/chains'

// A type-only import of FEATURES: the chains utils module pulls safe-deployments into the bundle
const HEDERA_FEATURE: `${FEATURES.HEDERA}` = 'HEDERA'

/**
 * Hedera's JSON-RPC relay (Hashio) reports native HBAR amounts pre-scaled to the 18-decimal
 * "weibar" convention, not HBAR's real 8-decimal (tinybar) `nativeCurrency.decimals`.
 */
export const HEDERA_RPC_NATIVE_DECIMALS = 18

/**
 * Decimals of a native-currency amount that was read through the chain's JSON-RPC relay
 * (`eth_getBalance`, indexed incoming transfers, INCOMING_ETHER webhooks).
 */
export const getRpcNativeCurrencyDecimals = (
  chain: Pick<Chain, 'features' | 'nativeCurrency'> | undefined,
): number | undefined => {
  if (!chain) return undefined
  return (chain.features as string[]).includes(HEDERA_FEATURE)
    ? HEDERA_RPC_NATIVE_DECIMALS
    : chain.nativeCurrency.decimals
}
