import type { ReactElement } from 'react'
import { Typography } from '@mui/material'
import { TxDataRow } from '@/components/transactions/TxDetails/Summary/TxDataRow'
import ExplorerButton from '@/components/common/ExplorerButton'
import { formatHederaTransactionId } from '@/utils/hedera'

type HederaTxIdRowProps = {
  transactionId: string
  explorerLink: { href: string; title: string }
}

const HederaTxIdRow = ({ transactionId, explorerLink }: HederaTxIdRowProps): ReactElement => (
  <TxDataRow datatestid="tx-hedera-transaction-id" title="Transaction ID">
    <Typography variant="body2" component="span" display="inline-flex" alignItems="center" gap={0.5}>
      {formatHederaTransactionId(transactionId)}
      <ExplorerButton {...explorerLink} />
    </Typography>
  </TxDataRow>
)

export default HederaTxIdRow
