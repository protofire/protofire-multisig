import type { TransactionItemPage } from '@safe-global/store/gateway/AUTO_GENERATED/transactions'
import type { listenerMiddlewareInstance } from '@/store'
import { createSelector } from '@reduxjs/toolkit'
import {
  isCreationTxInfo,
  isCustomTxInfo,
  isIncomingTransfer,
  isMultisigExecutionInfo,
  isTransactionListItem,
} from '@/utils/transaction-guards'
import { txDispatch, TxEvent } from '@/services/tx/txEvents'
import { clearPendingTx, selectPendingTxIdsBySafe, selectPendingTxs } from './pendingTxsSlice'
import { makeLoadableSlice } from './common'
import { selectSafeInfo } from './slices'
import { cgwApi } from '@safe-global/store/gateway/AUTO_GENERATED/owners'

const { slice, selector } = makeLoadableSlice('txHistory', undefined as TransactionItemPage | undefined)

export const txHistorySlice = slice
export const selectTxHistory = selector

export const selectOutgoingTransactions = createSelector(selectTxHistory, (txHistory) => {
  return txHistory.data?.results.filter(isTransactionListItem).filter((tx) => {
    return !isIncomingTransfer(tx.transaction.txInfo) && !isCreationTxInfo(tx.transaction.txInfo)
  })
})

export const txHistoryListener = (listenerMiddleware: typeof listenerMiddlewareInstance) => {
  listenerMiddleware.startListening({
    actionCreator: txHistorySlice.actions.set,
    effect: (action, listenerApi) => {
      if (!action.payload.data) {
        return
      }

      const state = listenerApi.getState()
      const safe = selectSafeInfo(state).data
      if (!safe) return

      const pendingTxs = selectPendingTxs(state)
      const pendingTxIds = selectPendingTxIdsBySafe(state, safe.chainId, safe.address.value)

      for (const result of action.payload.data.results) {
        if (!isTransactionListItem(result)) {
          continue
        }

        const pendingTxId = pendingTxIds.find((txId) =>
          isMultisigExecutionInfo(result.transaction.executionInfo)
            ? pendingTxs[txId].nonce === result.transaction.executionInfo.nonce
            : false,
        )

        if (!pendingTxId) continue

        // Invalidate getOwnedSafe cache as nested Safe was (likely) created
        if (isCustomTxInfo(result.transaction.txInfo)) {
          const method = result.transaction.txInfo.methodName
          const deployedSafe = method === 'createProxyWithNonce'
          const likelyDeployedSafe = method === 'multiSend'

          if (deployedSafe || likelyDeployedSafe) {
            const safeAddress = safe.address.value
            const chainId = safe.chainId

            if (chainId && safeAddress) {
              listenerApi.dispatch(
                cgwApi.util.invalidateTags([
                  {
                    type: 'owners',
                  },
                ]),
              )
            }
          }
        }

        const pendingTx = pendingTxs[pendingTxId]

        if (pendingTxId === result.transaction.id) {
          const txHash = 'txHash' in pendingTx ? pendingTx.txHash : undefined
          txDispatch(TxEvent.SUCCESS, {
            nonce: pendingTx.nonce,
            txId: pendingTxId,
            chainId: pendingTx.chainId,
            safeAddress: pendingTx.safeAddress,
            groupKey: pendingTxs[pendingTxId]?.groupKey,
            txHash,
          })
        } else {
          listenerApi.dispatch(clearPendingTx({ txId: pendingTxId }))
        }
      }
    },
  })
}
