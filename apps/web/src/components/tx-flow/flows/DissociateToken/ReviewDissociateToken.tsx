import { useContext, useEffect, type PropsWithChildren } from 'react'
import { Typography } from '@mui/material'
import EthHashInfo from '@/components/common/EthHashInfo'
import ExplorerButton from '@/components/common/ExplorerButton'
import ReviewTransaction from '@/components/tx/ReviewTransactionV2'
import { SafeTxContext } from '@/components/tx-flow/SafeTxProvider'
import { createTx } from '@/services/tx/tx-sender'
import { createDissociateTokenTx } from '@/services/tx/associateTokenParams'
import useSafeInfo from '@/hooks/useSafeInfo'
import { useCurrentChain } from '@/hooks/useChains'
import { getHederaNetwork, getHederaTokenExplorerLink } from '@/utils/hedera'
import { Errors, logError } from '@/services/exceptions'
import type { DissociateTokenFlowProps } from '.'

export const ReviewDissociateToken = ({
  params,
  onSubmit,
  children,
}: PropsWithChildren<{ params: DissociateTokenFlowProps; onSubmit: () => void }>) => {
  const { setSafeTx, safeTxError, setSafeTxError } = useContext(SafeTxContext)
  const { safeAddress } = useSafeInfo()
  const network = getHederaNetwork(useCurrentChain())
  const token = params.token

  useEffect(() => {
    const txParams = createDissociateTokenTx(safeAddress, token.evmAddress)
    createTx(txParams).then(setSafeTx).catch(setSafeTxError)
  }, [token, safeAddress, setSafeTx, setSafeTxError])

  useEffect(() => {
    if (safeTxError) {
      logError(Errors._824, safeTxError.message)
    }
  }, [safeTxError])

  return (
    <ReviewTransaction onSubmit={onSubmit}>
      <Typography color="primary.light">Selected token to dissociate</Typography>

      <EthHashInfo address={token.evmAddress} showCopyButton shortAddress={false}>
        {network && (
          <ExplorerButton title="View token on HashScan" href={getHederaTokenExplorerLink(network, token.evmAddress)} />
        )}
      </EthHashInfo>

      {token.balance !== 0 && (
        <Typography color="error" mt={2}>
          This token still has a non-zero balance ({token.balance}). Hedera requires the balance to be zero before it
          can be dissociated — this transaction will fail on-chain until the Safe transfers the remaining balance away.
        </Typography>
      )}

      {children}
    </ReviewTransaction>
  )
}
