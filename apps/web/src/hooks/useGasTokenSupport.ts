import { useState } from 'react'
import useAsync from '@safe-global/utils/hooks/useAsync'
import { useCurrentChain, useHasFeature } from '@/hooks/useChains'
import { FEATURES } from '@/utils/featureToggled'
import { fetchGasTokenSupport } from '@/services/tx/gasTokenFee'
import { sameAddress } from '@safe-global/utils/utils/addresses'

export const useGasTokenSupport = (gasTokenAddress?: string) => {
  const [attempt, setAttempt] = useState(0)
  const chain = useCurrentChain()
  const enabled = useHasFeature(FEATURES.PAY_FROM_SAFE)
  const chainId = chain?.chainId
  const [result, error, loading] = useAsync(
    () =>
      enabled && chainId ? fetchGasTokenSupport(chainId).then((support) => ({ chainId, support, attempt })) : undefined,
    [enabled, chainId, attempt],
  )
  const support = result?.chainId === chainId && result?.attempt === attempt ? result?.support : undefined
  const token =
    support?.gasTokens.find((entry) => gasTokenAddress && sameAddress(entry.address, gasTokenAddress)) ??
    support?.gasTokens[0]
  const isSupported = !!(enabled && token && support?.refundReceiver)

  return {
    retry: () => setAttempt((value) => value + 1),
    isSupported,
    isLoading: !!(enabled && chainId && (loading || (!support && !error))),
    error: enabled ? error : undefined,
    gasToken: isSupported ? token : undefined,
    gasTokens: enabled ? support?.gasTokens : undefined,
    refundReceiver: enabled ? support?.refundReceiver : undefined,
  }
}
