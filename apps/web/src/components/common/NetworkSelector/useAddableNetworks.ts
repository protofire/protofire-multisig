import { useMemo, useState } from 'react'
import { useCompatibleNetworks } from '@safe-global/utils/features/multichain/hooks/useCompatibleNetworks'
import { useSafeCreationData, hasMultiChainAddNetworkFeature } from '@/features/multichain'
import useChains from '@/hooks/useChains'
import type { Chain } from '@safe-global/store/gateway/AUTO_GENERATED/chains'

type UseAddableNetworksOptions = {
  enabled?: boolean
}

const EMPTY_CHAINS: Chain[] = []

export const useAddableNetworks = (
  safeAddress: string,
  deployedChains: string[],
  { enabled = true }: UseAddableNetworksOptions = {},
) => {
  const { configs } = useChains()

  // Once enabled, stay enabled: dropping the fetch on close would refetch (and flash a spinner) on every reopen.
  const [hasBeenEnabled, setHasBeenEnabled] = useState(enabled)
  if (enabled && !hasBeenEnabled) {
    setHasBeenEnabled(true)
  }

  // Key on chain id content, not array identity, so upstream recomputes with equal ids do not refetch.
  const deployedChainsKey = useMemo(() => [...deployedChains].sort().join(','), [deployedChains])

  const deployedChainInfos = useMemo(() => {
    if (!hasBeenEnabled || !deployedChainsKey) return EMPTY_CHAINS
    const ids = deployedChainsKey.split(',')
    return configs.filter((chain) => ids.includes(chain.chainId))
  }, [configs, deployedChainsKey, hasBeenEnabled])

  // Empty address + chain list skips the fetch loop inside useSafeCreationData when disabled.
  const safeCreationResult = useSafeCreationData(hasBeenEnabled ? safeAddress : '', deployedChainInfos)
  const [safeCreationData] = safeCreationResult

  const allCompatibleChains = useCompatibleNetworks(safeCreationData, configs)
  const isUnsupportedSafeCreationVersion = allCompatibleChains.length === 0

  const availableNetworks = useMemo(
    () =>
      allCompatibleChains.filter(
        (config) => !deployedChains.includes(config.chainId) && hasMultiChainAddNetworkFeature(config),
      ),
    [allCompatibleChains, deployedChains],
  )

  const noAvailableNetworks = useMemo(() => availableNetworks.every((config) => !config.available), [availableNetworks])

  return {
    availableNetworks,
    safeCreationResult,
    isUnsupportedSafeCreationVersion,
    noAvailableNetworks,
  }
}
