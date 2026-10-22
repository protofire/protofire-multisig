import { useMemo } from 'react'
import type { ReactElement } from 'react'

import { TxListGrid } from '@/components/transactions/TxList'
import RecoveryListItem from '@/features/recovery/components/RecoveryListItem'
import { useRecoveryQueue, useUnavailableRecoveryQueue } from '@/features/recovery/hooks/useRecoveryQueue'
import useRecovery from '@/features/recovery/hooks/useRecovery'
import { RecoveryLoadError } from '@/features/recovery/components/RecoveryLoadError'
import UnavailableRecoveryListItem from '@/features/recovery/components/UnavailableRecoveryListItem'
import { groupRecoveryTransactions } from '@/utils/tx-list'
import useTxQueue from '@/hooks/useTxQueue'
import GroupedRecoveryListItems from '../GroupedRecoveryListItems'
import { isRecoveryQueueItem } from '@/utils/transaction-guards'
import type { RecoveryQueueItem } from '@/features/recovery/services/recovery-state'
import { useIsRecoverySupported } from '../../hooks/useIsRecoverySupported'

import labelCss from '@/components/transactions/GroupLabel/styles.module.css'

function InternalRecoveryList({ recoveryQueue }: { recoveryQueue: Array<RecoveryQueueItem> }): ReactElement {
  const queue = useTxQueue()

  const groupedItems = useMemo(() => {
    if (!queue?.page?.results || queue.page.results.length === 0) {
      return recoveryQueue
    }
    return groupRecoveryTransactions(queue.page.results, recoveryQueue)
  }, [queue, recoveryQueue])

  const transactions = useMemo(() => {
    return groupedItems.map((item, index) => {
      if (Array.isArray(item)) {
        return <GroupedRecoveryListItems items={item} key={index} />
      }

      if (isRecoveryQueueItem(item)) {
        return <RecoveryListItem item={item} key={item.transactionHash} />
      }

      return null
    })
  }, [groupedItems])

  return <TxListGrid>{transactions}</TxListGrid>
}

function RecoveryList(): ReactElement | null {
  const supportsRecovery = useIsRecoverySupported()
  const [, recoveryError] = useRecovery()
  const recoveryQueue = useRecoveryQueue()
  const unavailableRecoveryQueue = useUnavailableRecoveryQueue()
  const hasPendingRecovery = recoveryQueue.length > 0 || unavailableRecoveryQueue.length > 0

  if (!supportsRecovery) return null
  if (!recoveryError && !hasPendingRecovery) return null

  return (
    <>
      {recoveryError && <RecoveryLoadError />}

      {hasPendingRecovery && (
        <>
          <div className={labelCss.container}>Pending recovery</div>

          <TxListGrid>
            {unavailableRecoveryQueue.map((item) => (
              <UnavailableRecoveryListItem item={item} key={`${item.address}-${item.args.queueNonce}`} />
            ))}

            {recoveryQueue.length > 0 && <InternalRecoveryList recoveryQueue={recoveryQueue} />}
          </TxListGrid>
        </>
      )}
    </>
  )
}

export default RecoveryList
