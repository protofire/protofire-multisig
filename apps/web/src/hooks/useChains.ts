import { useMemo } from 'react'
import { type Chain } from '@safe-global/store/gateway/AUTO_GENERATED/chains'
import { useGetChainsConfigQuery } from '@safe-global/store/gateway'
import useChainId from './useChainId'
import type { FEATURES } from '@safe-global/utils/utils/chains'
import { hasFeature } from '@safe-global/utils/utils/chains'
import { getRtkQueryErrorMessage } from '@/utils/rtkQuery'
import { STATIC_CHAINS_REQUEST_ID_PREFIX } from '@/store'

const useChains = (): { configs: Chain[]; error?: string; loading?: boolean; isRuntimeData?: boolean } => {
  const result = useGetChainsConfigQuery()
  const { data, error, isLoading } = result

  const configs = useMemo(() => {
    if (!data) return []
    // data is already EntityState with { ids: string[], entities: { [id: string]: Chain } }
    return data.ids.map((id) => data.entities[id]!)
  }, [data])

  // requestId is rewritten the instant a runtime fetch starts (store/index.ts's seed keeps its
  // static-prefixed id only until then), so a non-static id alone means "fetching", not
  // "fetched" — gate on the request having settled: fulfilled (isSuccess && !isFetching) with a
  // non-static requestId, or rejected (isError), in which case we fall back to initialising off
  // the snapshot (degraded but usable) rather than blocking wallet setup forever.
  const isRuntimeData =
    (result.isSuccess &&
      !result.isFetching &&
      !!result.requestId &&
      !result.requestId.startsWith(STATIC_CHAINS_REQUEST_ID_PREFIX)) ||
    result.isError

  return useMemo(
    () => ({
      configs,
      error: error ? getRtkQueryErrorMessage(error) : undefined,
      loading: isLoading,
      isRuntimeData,
    }),
    [configs, error, isLoading, isRuntimeData],
  )
}

export default useChains

export const useChain = (chainId: string): Chain | undefined => {
  const { data } = useGetChainsConfigQuery()

  return useMemo(() => {
    if (!data) return undefined
    // data.entities is a direct lookup by chainId
    return data.entities[chainId]
  }, [data, chainId])
}

export const useCurrentChain = (): Chain | undefined => {
  const chainId = useChainId()
  return useChain(chainId)
}

/**
 * Checks if a feature is enabled on the current chain.
 *
 * @param feature name of the feature to check for
 * @returns `true`, if the feature is enabled on the current chain. Otherwise `false`
 */
export const useHasFeature = (feature: FEATURES): boolean | undefined => {
  const currentChain = useCurrentChain()
  return currentChain ? hasFeature(currentChain, feature) : undefined
}
