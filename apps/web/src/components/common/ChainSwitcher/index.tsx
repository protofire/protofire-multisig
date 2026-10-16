import type { ReactElement } from 'react'
import { useCallback, useState } from 'react'
import { Button, CircularProgress, Typography } from '@mui/material'
import { useCurrentChain } from '@/hooks/useChains'
import useOnboard from '@/hooks/wallets/useOnboard'
import useIsWrongChain from '@/hooks/useIsWrongChain'
import { switchWalletChain } from '@/services/tx/tx-sender/sdk'
import { useAppDispatch } from '@/store'
import { showNotification } from '@/store/notificationsSlice'

const ChainSwitcher = ({
  fullWidth,
  primaryCta = false,
}: {
  fullWidth?: boolean
  primaryCta?: boolean
}): ReactElement | null => {
  const chain = useCurrentChain()
  const onboard = useOnboard()
  const isWrongChain = useIsWrongChain()
  const [loading, setIsLoading] = useState<boolean>(false)
  const dispatch = useAppDispatch()

  const handleChainSwitch = useCallback(async () => {
    if (!onboard || !chain) return
    setIsLoading(true)
    const wallet = await switchWalletChain(onboard, chain.chainId)
    setIsLoading(false)

    // The wallet refused (rejected prompt, or TronLink, which can't change its network from the app)
    if (wallet && wallet.chainId !== chain.chainId) {
      dispatch(
        showNotification({
          variant: 'warning',
          groupKey: 'chain-switch-failed',
          message: `Switch your wallet to ${chain.chainName} and try again.`,
        }),
      )
    }
  }, [chain, onboard, dispatch])

  if (!isWrongChain) return null

  return (
    <Button
      onClick={handleChainSwitch}
      variant={primaryCta ? 'contained' : 'outlined'}
      sx={{ minWidth: '200px' }}
      size={primaryCta ? 'medium' : 'small'}
      fullWidth={fullWidth}
      color="primary"
      disabled={loading}
    >
      {loading ? (
        <CircularProgress size={20} />
      ) : (
        <>
          <Typography noWrap>Switch to&nbsp;</Typography>
          <img
            src={chain?.chainLogoUri ?? undefined}
            alt={`${chain?.chainName} Logo`}
            width={24}
            height={24}
            loading="lazy"
          />
          <Typography noWrap>&nbsp;{chain?.chainName}</Typography>
        </>
      )}
    </Button>
  )
}

export default ChainSwitcher
