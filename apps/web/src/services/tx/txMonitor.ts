import { isTronChain } from '@/utils/tron'
import { didRevert, type EthersError } from '@/utils/ethers-utils'

import { txDispatch, txSubscribe, TxEvent } from '@/services/tx/txEvents'

import { POLLING_INTERVAL } from '@/config/constants'
import { getSafeTransaction } from '@/utils/transactions'
import { asError } from '@safe-global/utils/services/exceptions/utils'
import { type JsonRpcProvider, type TransactionReceipt } from 'ethers'
import { SimpleTxWatcher } from '@/utils/SimpleTxWatcher'
import { getRelayTxStatus, RelayStatus } from '@safe-global/utils/services/RelayTxWatcher'
import { getBaseUrl } from '@safe-global/store/gateway/cgwClient'

export function _getRemainingTimeout(defaultTimeout: number, submittedAt?: number) {
  const timeoutInMs = defaultTimeout * 60_000
  const timeSinceSubmission = submittedAt !== undefined ? Date.now() - submittedAt : 0

  return Math.max(timeoutInMs - timeSinceSubmission, 1)
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Poll for transaction receipt on Tron.
 * ethers.js provider.on('block') and TransactionResponse.wait() don't work
 * reliably on Tron because Tron's nonce/block semantics differ from Ethereum.
 */
async function waitForTronReceipt(
  provider: JsonRpcProvider,
  txHash: string,
  maxAttempts = 40,
): Promise<TransactionReceipt | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const receipt = await provider.getTransactionReceipt(txHash)
      if (receipt !== null) {
        return receipt
      }
    } catch (e) {
      // getTransactionReceipt may fail on Tron; keep polling
      console.warn('waitForTronReceipt: getTransactionReceipt failed, retrying', e)
    }
    await delay(3000)
  }
  return null
}

// Provider must be passed as an argument as it is undefined until initialised by `useInitWeb3`
export const waitForTx = async (
  provider: JsonRpcProvider,
  txIds: string[],
  txHash: string,
  safeAddress: string,
  walletAddress: string,
  walletNonce: number,
  nonce: number,
  chainId: string,
) => {
  const processReceipt = (receipt: TransactionReceipt | null, txIds: string[]) => {
    if (receipt === null) {
      txIds.forEach((txId) => {
        txDispatch(TxEvent.FAILED, {
          nonce,
          txId,
          chainId,
          safeAddress,
          error: new Error(`Transaction not found. It might have been replaced or cancelled in the connected wallet.`),
        })
      })
    } else if (didRevert(receipt)) {
      txIds.forEach((txId) => {
        txDispatch(TxEvent.REVERTED, {
          nonce,
          txId,
          chainId,
          safeAddress,
          error: new Error('Transaction reverted by EVM.'),
        })
      })
    } else {
      txIds.forEach((txId) => {
        txDispatch(TxEvent.PROCESSED, {
          nonce,
          txId,
          chainId,
          safeAddress,
          txHash,
        })
      })
    }
  }

  const processError = (err: any, txIds: string[]) => {
    const error = err as EthersError

    txIds.forEach((txId) => {
      txDispatch(TxEvent.FAILED, {
        nonce,
        txId,
        chainId,
        safeAddress,
        error: asError(error),
      })
    })
  }

  try {
    const isSafeTx = !!(await getSafeTransaction(txHash, chainId, safeAddress))
    if (isSafeTx) {
      // Poll for the transaction until it has a transactionHash and start the watcher
      const interval = setInterval(async () => {
        const safeTx = await getSafeTransaction(txHash, chainId, safeAddress)
        if (!safeTx?.txHash) return

        clearInterval(interval)

        if (isTronChain(chainId)) {
          const receipt = await waitForTronReceipt(provider, safeTx.txHash)
          processReceipt(receipt, txIds)
        } else {
          const receipt = await SimpleTxWatcher.getInstance().watchTxHash(
            safeTx.txHash,
            walletAddress,
            walletNonce,
            provider,
          )
          processReceipt(receipt, txIds)
        }
      }, POLLING_INTERVAL)
    } else {
      if (isTronChain(chainId)) {
        const receipt = await waitForTronReceipt(provider, txHash)
        processReceipt(receipt, txIds)
      } else {
        const receipt = await SimpleTxWatcher.getInstance().watchTxHash(txHash, walletAddress, walletNonce, provider)
        processReceipt(receipt, txIds)
      }
    }
  } catch (error) {
    processError(error, txIds)
  }
}

const WAIT_FOR_RELAY_TIMEOUT = 3 * 60_000 // 3 minutes
const activeSafePaysTasks = new Set<string>()

export const waitForRelayedTx = (
  taskId: string,
  txIds: string[],
  chainId: string,
  safeAddress: string,
  nonce: number,
  groupKey?: string,
  isSafePays = false,
): void => {
  const baseUrl = getBaseUrl()
  if (!baseUrl) {
    txIds.forEach((txId) =>
      txDispatch(TxEvent.FAILED, {
        nonce,
        txId,
        chainId,
        safeAddress,
        error: new Error('CGW base URL not configured'),
        groupKey,
      }),
    )
    return
  }

  const taskKey = `${chainId}:${taskId}`
  if (isSafePays && activeSafePaysTasks.has(taskKey)) return
  if (isSafePays) activeSafePaysTasks.add(taskKey)

  let intervalId: NodeJS.Timeout
  let failAfterTimeoutId: NodeJS.Timeout | undefined
  let stopped = false
  let fetching = false
  let unsubscribe: (() => void) | undefined
  const stop = () => {
    stopped = true
    clearInterval(intervalId)
    clearTimeout(failAfterTimeoutId)
    if (isSafePays) activeSafePaysTasks.delete(taskKey)
    unsubscribe?.()
  }
  if (isSafePays) {
    unsubscribe = txSubscribe(TxEvent.SUCCESS, (detail) => {
      if (detail.chainId === chainId && detail.txId && txIds.includes(detail.txId)) stop()
    })
  }

  intervalId = setInterval(async () => {
    if (fetching || stopped) return
    fetching = true
    const relayStatus = await getRelayTxStatus(baseUrl, chainId, taskId).catch(() => undefined)
    fetching = false
    if (stopped) return

    // Request failed or not found yet
    if (!relayStatus) {
      return
    }

    switch (relayStatus.status) {
      case RelayStatus.Included:
        if (isSafePays && !relayStatus.receipt?.transactionHash) return
        txIds.forEach((txId) =>
          txDispatch(TxEvent.PROCESSED, {
            nonce,
            txId,
            groupKey,
            chainId,
            safeAddress,
            txHash: relayStatus.receipt?.transactionHash,
          }),
        )
        break
      case RelayStatus.Reverted:
        txIds.forEach((txId) =>
          txDispatch(TxEvent.REVERTED, {
            nonce,
            txId,
            chainId,
            safeAddress,
            error: new Error('Relayed transaction reverted by EVM.'),
            groupKey,
          }),
        )
        break
      case RelayStatus.Rejected:
        txIds.forEach((txId) =>
          txDispatch(TxEvent.FAILED, {
            nonce,
            txId,
            chainId,
            safeAddress,
            error: new Error('Relayed transaction was rejected by relay provider.'),
            groupKey,
          }),
        )
        break
      default:
        // Pending or Submitted — keep polling
        return
    }

    stop()
  }, POLLING_INTERVAL)

  // OZ owns expiry and resubmission. A browser timeout does not mean the transaction failed.
  if (isSafePays) return

  failAfterTimeoutId = setTimeout(() => {
    txIds.forEach((txId) =>
      txDispatch(TxEvent.FAILED, {
        nonce,
        txId,
        chainId,
        safeAddress,
        error: new Error(
          `Transaction not relayed in ${
            WAIT_FOR_RELAY_TIMEOUT / 60_000
          } minutes. Be aware that it might still be relayed.`,
        ),
        groupKey,
      }),
    )

    stop()
  }, WAIT_FOR_RELAY_TIMEOUT)
}
