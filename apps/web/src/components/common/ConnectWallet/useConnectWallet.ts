import { useCallback } from 'react'
import { useRouter } from 'next/router'
import useOnboard, { connectWallet, getConnectedWallet } from '@/hooks/wallets/useOnboard'
import { useUrlChainId } from '@/hooks/useChainId'
import { useChain } from '@/hooks/useChains'
import { AppRoutes } from '@/config/routes'
import { isWalletForChain } from '@/utils/wallets'

const useConnectWallet = () => {
  const onboard = useOnboard()
  const router = useRouter()
  const urlChain = useChain(useUrlChainId() ?? '')

  return useCallback(async () => {
    if (!onboard) {
      return undefined
    }

    const wallets = await connectWallet(onboard)
    const wallet = wallets && getConnectedWallet(wallets)

    // The picked wallet can't use the page's chain (e.g. TronLink on an EVM chain, HashPack off Hedera):
    // leave for one it can use. A Safe goes to the accounts list; other pages drop the chain and
    // follow the wallet's chain.
    if (wallet && urlChain && !isWalletForChain(wallet, urlChain)) {
      const { safe, chain: _chain, ...query } = router.query
      router.replace(safe ? AppRoutes.welcome.accounts : { pathname: router.pathname, query })
    }

    return wallets
  }, [onboard, router, urlChain])
}

export default useConnectWallet
