import { useContext, useEffect, type PropsWithChildren } from 'react'
import { Typography } from '@mui/material'
import EthHashInfo from '@/components/common/EthHashInfo'
import ExplorerButton from '@/components/common/ExplorerButton'
import ReviewTransaction from '@/components/tx/ReviewTransactionV2'
import { SafeTxContext } from '@/components/tx-flow/SafeTxProvider'
import { TxFlowContext, type TxFlowContextType } from '@/components/tx-flow/TxFlowProvider'
import { createTx } from '@/services/tx/tx-sender'
import { createAssociateTokenTx } from '@/services/tx/associateTokenParams'
import useSafeInfo from '@/hooks/useSafeInfo'
import { useCurrentChain } from '@/hooks/useChains'
import { getHederaNetwork, getHederaTokenExplorerLink } from '@/utils/hedera'
import { Errors, logError } from '@/services/exceptions'
import type { AssociateTokenParams } from '.'

const ReviewAssociateToken = ({ onSubmit, children }: PropsWithChildren<{ onSubmit: () => void }>) => {
  const { data } = useContext(TxFlowContext) as TxFlowContextType<AssociateTokenParams>
  const { setSafeTx, safeTxError, setSafeTxError } = useContext(SafeTxContext)
  const { safeAddress } = useSafeInfo()
  const network = getHederaNetwork(useCurrentChain())
  const token = data?.token

  useEffect(() => {
    if (!token) return
    const txParams = createAssociateTokenTx(safeAddress, token.evmAddress)
    createTx(txParams).then(setSafeTx).catch(setSafeTxError)
  }, [token, safeAddress, setSafeTx, setSafeTxError])

  useEffect(() => {
    if (safeTxError) {
      logError(Errors._823, safeTxError.message)
    }
  }, [safeTxError])

  return (
    <ReviewTransaction onSubmit={onSubmit}>
      {token && (
        <>
          <Typography color="primary.light">Selected token to associate</Typography>

          <EthHashInfo
            address={token.evmAddress}
            name={`${token.name} (${token.symbol})`}
            showCopyButton
            shortAddress={false}
          >
            {network && (
              <ExplorerButton
                title="View token on HashScan"
                href={getHederaTokenExplorerLink(network, token.evmAddress)}
              />
            )}
          </EthHashInfo>
        </>
      )}

      {children}
    </ReviewTransaction>
  )
}

export default ReviewAssociateToken
