import { useHasFeature } from '@/hooks/useChains'
import { FEATURES } from '@safe-global/utils/utils/chains'

/** True when the connected chain's config lists the Oasis signed eth_call flag. Unknown (not yet loaded) counts as false. */
const useIsOasisSignedEthCallEnabled = (): boolean =>
  useHasFeature(FEATURES.OASIS_SIGNED_ETH_CALL_GAS_ESTIMATION) === true

export default useIsOasisSignedEthCallEnabled
