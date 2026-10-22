import type { ReactElement } from 'react'
import type { HederaTransactionDetails } from '@/utils/hedera'
import useHederaTransactionExplorerLink from '@/hooks/useHederaTransactionExplorerLink'
import HederaTxIdRow from './HederaTxIdRow'
import EvmTxIdRow from './EvmTxIdRow'

/**
 * Picks the chain-specific row identifying an executed transaction. A new non-EVM identifier
 * gets its own row component + branch here, keeping `Summary` itself chain-agnostic.
 */
const TransactionIdentifierRow = ({ txDetails }: { txDetails?: HederaTransactionDetails }): ReactElement | null => {
  const hederaExplorerLink = useHederaTransactionExplorerLink(txDetails?.hederaTransactionId)

  // Native Hedera transfer: its `txHash` is a backend placeholder no EVM explorer knows about
  if (txDetails?.hederaTransactionId && hederaExplorerLink) {
    return <HederaTxIdRow transactionId={txDetails.hederaTransactionId} explorerLink={hederaExplorerLink} />
  }

  if (txDetails?.txHash) {
    return <EvmTxIdRow txHash={txDetails.txHash} />
  }

  return null
}

export default TransactionIdentifierRow
