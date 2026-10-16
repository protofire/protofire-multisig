import type { MouseEvent } from 'react'
import { useState } from 'react'
import { Box, ButtonBase, Paper, Popover } from '@mui/material'
import css from '@/components/common/ConnectWallet/styles.module.css'
import ExpandLessIcon from '@mui/icons-material/KeyboardArrowUpRounded'
import ExpandMoreIcon from '@mui/icons-material/KeyboardArrowDownRounded'
import { type ConnectedWallet } from '@/hooks/wallets/useOnboard'
import WalletOverview from '../WalletOverview'
import WalletInfo from '@/components/common/WalletInfo'
import useChainId from '@/hooks/useChainId'

const AccountCenter = ({ wallet }: { wallet: ConnectedWallet }) => {
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null)
  const currentChainId = useChainId()
  // web3-onboard's `wallet.balance` is sourced from the wallet provider's own
  // `eth_getBalance`. For TronLink (which routes RPC through the user's chosen
  // fullNode independent of the app's selected chain) this can leak the
  // mainnet balance when the app is on Shasta testnet (BUG-06 / GSD-12881).
  // Suppress the balance string entirely on chain mismatch — better empty than
  // wrong.
  const balance = wallet.chainId === currentChainId ? wallet.balance : ''

  const openWalletInfo = (event: MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const closeWalletInfo = () => {
    setAnchorEl(null)
  }

  const open = Boolean(anchorEl)
  const id = open ? 'simple-popover' : undefined

  return (
    <>
      <ButtonBase
        onClick={openWalletInfo}
        aria-describedby={id}
        disableRipple
        sx={{ alignSelf: 'stretch' }}
        data-testid="open-account-center"
      >
        <Box className={`${css.buttonContainer} ${css.connectedButton}`}>
          <WalletOverview wallet={wallet} balance={balance} showBalance />

          <Box display="flex" alignItems="center" justifyContent="flex-end" ml="auto">
            {open ? (
              <ExpandLessIcon color="border" sx={{ fontSize: 16 }} />
            ) : (
              <ExpandMoreIcon data-testid="ExpandMoreIcon" color="border" sx={{ fontSize: 16 }} />
            )}
          </Box>
        </Box>
      </ButtonBase>

      <Popover
        id={id}
        open={open}
        anchorEl={anchorEl}
        onClose={closeWalletInfo}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
        sx={{
          '& > .MuiPaper-root': {
            top: 'var(--header-height) !important',
          },
        }}
        transitionDuration={0}
      >
        <Paper className={css.popoverContainer}>
          <WalletInfo wallet={wallet} handleClose={closeWalletInfo} balance={balance} />
        </Paper>
      </Popover>
    </>
  )
}

export default AccountCenter
