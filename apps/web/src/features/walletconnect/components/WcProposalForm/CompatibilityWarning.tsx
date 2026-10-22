import { Alert, Typography } from '@mui/material'
import type { WalletKitTypes } from '@reown/walletkit'

import ChainIndicator from '@/components/common/ChainIndicator'
import ScrollableChainList from '@/components/common/ScrollableChainList'
import { useCompatibilityWarning } from './useCompatibilityWarning'
import useSafeInfo from '@/hooks/useSafeInfo'

import css from './styles.module.css'

export const CompatibilityWarning = ({
  proposal,
  chainIds,
}: {
  proposal: WalletKitTypes.SessionProposal
  chainIds: Array<string>
}) => {
  const { safe } = useSafeInfo()
  const isUnsupportedChain = !chainIds.includes(safe.chainId)
  const { severity, message } = useCompatibilityWarning(proposal, isUnsupportedChain)

  return (
    <>
      <Alert severity={severity} className={css.alert}>
        {message}
      </Alert>

      {isUnsupportedChain && (
        <>
          <Typography mt={3} mb={1} variant="h5">
            Supported networks ({chainIds.length})
          </Typography>

          <ScrollableChainList maxHeight={120}>
            {chainIds.map((chainId) => (
              <ChainIndicator inline chainId={chainId} key={chainId} className={css.chain} />
            ))}
          </ScrollableChainList>
        </>
      )}
    </>
  )
}
