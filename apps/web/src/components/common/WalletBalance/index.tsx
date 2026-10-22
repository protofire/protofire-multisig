import { formatVisualAmount } from '@safe-global/utils/utils/formatters'
import { Skeleton } from '@mui/material'
import { useCurrentChain } from '@/hooks/useChains'
import { getRpcNativeCurrencyDecimals } from '@/utils/rpcNativeDecimals'

const WalletBalance = ({ balance }: { balance: string | bigint | undefined }) => {
  const currentChain = useCurrentChain()

  if (balance === undefined) {
    return <Skeleton width={30} variant="text" sx={{ display: 'inline-block' }} />
  }

  if (typeof balance === 'string') {
    return <>{balance}</>
  }

  const decimals = getRpcNativeCurrencyDecimals(currentChain) ?? 18

  return (
    <>
      {formatVisualAmount(balance, decimals)} {currentChain?.nativeCurrency.symbol ?? 'ETH'}
    </>
  )
}

export default WalletBalance
