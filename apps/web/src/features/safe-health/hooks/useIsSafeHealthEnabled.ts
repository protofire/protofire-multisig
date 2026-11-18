import { useHasFeature } from '@/hooks/useChains'
import { useIsProtofireHost } from '@/hooks/useIsProtofireHost'
import { FEATURES } from '@safe-global/utils/utils/chains'

// Every hook runs on each render, so the order of hooks never changes
export const useIsSafeHealthEnabled = (): boolean | undefined => {
  const hasFlag = useHasFeature(FEATURES.SAFE_HEALTH)
  const isTron = useHasFeature(FEATURES.TRON)
  const isHedera = useHasFeature(FEATURES.HEDERA)
  const isHost = useIsProtofireHost()

  if (hasFlag === undefined || isHost === undefined) return undefined
  return hasFlag && isHost && !isTron && !isHedera
}
