import type { ReactElement } from 'react'
import { generateDataRowValue, TxDataRow } from '@/components/transactions/TxDetails/Summary/TxDataRow'

const EvmTxIdRow = ({ txHash }: { txHash: string }): ReactElement => (
  <TxDataRow datatestid="tx-hash" title="Transaction hash">
    {generateDataRowValue(txHash, 'hash', true)}{' '}
  </TxDataRow>
)

export default EvmTxIdRow
