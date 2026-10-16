import type { TransactionItemPage } from '@safe-global/store/gateway/AUTO_GENERATED/transactions'
import { useEffect, useMemo } from 'react'
import useAsync, { type AsyncResult } from '@safe-global/utils/hooks/useAsync'
import { Errors, logError } from '@/services/exceptions'
import useSafeInfo from '../useSafeInfo'
import useEffectiveSafeParams from '../useEffectiveSafeParams'
import { getTxHistory } from '@/services/transactions'
import { useAppSelector } from '@/store'
import { selectSettings } from '@/store/settingsSlice'
import { useHasFeature } from '../useChains'
import useIntervalCounter from '../useIntervalCounter'
import { PendingStatus, selectPendingTxs } from '@/store/pendingTxsSlice'
import { usePendingTxIds } from '../usePendingTxs'

import { FEATURES } from '@safe-global/utils/utils/chains'

// Poll history while a pending tx is stuck INDEXING, in case the CGW response we got was stale/cached
const INDEXING_POLL_INTERVAL = 10_000
const INDEXING_POLL_MAX_ATTEMPTS = 30 // ~5 minutes per pending tx

const useLoadTxHistory = (): AsyncResult<TransactionItemPage> => {
  const { safe, safeLoaded } = useSafeInfo()
  const { effectiveAddress, effectiveChainId } = useEffectiveSafeParams()
  const { txHistoryTag } = safe
  const { hideSuspiciousTransactions } = useAppSelector(selectSettings)
  const hasDefaultTokenlist = useHasFeature(FEATURES.DEFAULT_TOKENLIST)
  const hideUntrustedTxs = (hasDefaultTokenlist && hideSuspiciousTransactions) ?? true
  const hideImitationTxs = hideSuspiciousTransactions ?? true

  const pendingTxIds = usePendingTxIds()
  const pendingTxs = useAppSelector(selectPendingTxs)
  // Joined id string (not just a boolean) so a second tx going INDEXING while the first is
  // still stuck also resets the budget, instead of inheriting the first tx's remaining count.
  const indexingTxIdsKey = useMemo(
    () => pendingTxIds.filter((txId) => pendingTxs[txId]?.status === PendingStatus.INDEXING).join(','),
    [pendingTxIds, pendingTxs],
  )
  const hasIndexingPendingTx = indexingTxIdsKey.length > 0

  // Counter only ticks while a tx is INDEXING, and stops itself once the budget is spent
  // (maxCount) — so a permanently INDEXING tx doesn't keep re-rendering the history list
  // every 10s forever.
  const [pollCount, resetPollCount] = useIntervalCounter(
    INDEXING_POLL_INTERVAL,
    hasIndexingPendingTx,
    INDEXING_POLL_MAX_ATTEMPTS,
  )
  const effectivePollCount = hasIndexingPendingTx ? pollCount : 0

  // Reset on every INDEXING transition, keyed on the actual set of INDEXING tx ids, so a new
  // INDEXING tx (even while another is already stuck) always starts its own budget at 0.
  useEffect(() => {
    resetPollCount()
  }, [indexingTxIdsKey, resetPollCount])

  // Re-fetch when chainId, address, hideSuspiciousTransactions, or txHistoryTag changes,
  // or on a bounded interval while a pending tx is stuck INDEXING
  const [data, error, loading] = useAsync<TransactionItemPage>(
    () => {
      if (!effectiveChainId || !effectiveAddress) return
      // For undeployed safes, return empty once safe info confirms not deployed
      if (safeLoaded && !safe.deployed) return Promise.resolve({ results: [] })

      return getTxHistory(effectiveChainId, effectiveAddress, hideUntrustedTxs, hideImitationTxs)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      effectiveChainId,
      effectiveAddress,
      hideSuspiciousTransactions,
      hasDefaultTokenlist,
      txHistoryTag,
      safeLoaded,
      safe.deployed,
      effectivePollCount,
    ],
    false,
  )

  // Log errors
  useEffect(() => {
    if (!error) return
    logError(Errors._602, error.message)
  }, [error])

  return [data, error, loading]
}

export default useLoadTxHistory
