import Identicon from '@/components/common/Identicon'
import { Box, Typography } from '@mui/material'
import { Suspense } from 'react'
import type { ReactElement } from 'react'

import EthHashInfo from '@/components/common/EthHashInfo'
import WalletIcon from '@/components/common/WalletIcon'
import type { ConnectedWallet } from '@/hooks/wallets/useOnboard'
import { useChain } from '@/hooks/useChains'
import useHederaAccountId from '@/hooks/useHederaAccountId'
import WalletBalance from '@/components/common/WalletBalance'
import { FEATURES, hasFeature } from '@safe-global/utils/utils/chains'

import css from './styles.module.css'

export const WalletIdenticon = ({ wallet, size = 32 }: { wallet: ConnectedWallet; size?: number }) => {
  return (
    <Box className={css.imageContainer}>
      <Identicon address={wallet.address} size={size} />
      <Suspense>
        <Box className={css.walletIcon}>
          <WalletIcon provider={wallet.label} icon={wallet.icon} width={size / 2} height={size / 2} />
        </Box>
      </Suspense>
    </Box>
  )
}

const WalletOverview = ({
  wallet,
  balance,
  showBalance,
}: {
  wallet: ConnectedWallet
  balance?: string
  showBalance?: boolean
}): ReactElement => {
  const walletChain = useChain(wallet.chainId)
  const prefix = walletChain?.shortName
  const hideNativeToken = walletChain && hasFeature(walletChain, FEATURES.HIDE_NATIVE_TOKEN)
  // Hedera's chain shortName ("hedera") is long enough that a "hedera:0x0000...236F" prefixed
  // address overflows this compact pill — show the shorter native account id instead, matching
  // how Hedera wallets identify an account primarily by its 0.0.X id, not its 0x alias.
  const { accountId: hederaAccountId, isHedera } = useHederaAccountId(wallet.address, wallet.chainId)

  return (
    <Box className={css.container}>
      <WalletIdenticon wallet={wallet} />

      <Box className={css.walletDetails}>
        <Typography variant="body2" component="div">
          {wallet.ens ? (
            <div>{wallet.ens}</div>
          ) : isHedera && hederaAccountId ? (
            <div>{hederaAccountId}</div>
          ) : (
            <EthHashInfo
              prefix={prefix || ''}
              address={wallet.address}
              showName={false}
              showAvatar={false}
              avatarSize={12}
              copyAddress={false}
            />
          )}
        </Typography>

        {showBalance && !hideNativeToken && (
          <Typography variant="caption" component="div" fontWeight="bold" display={{ xs: 'none', sm: 'block' }}>
            <WalletBalance balance={balance} />
          </Typography>
        )}
      </Box>
    </Box>
  )
}

export default WalletOverview
