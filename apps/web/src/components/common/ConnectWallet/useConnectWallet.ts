import { useCallback } from 'react'
import { useRouter } from 'next/router'
import useOnboard, { connectWallet, getConnectedWallet } from '@/hooks/wallets/useOnboard'
import { useUrlChainId } from '@/hooks/useChainId'
import { AppRoutes } from '@/config/routes'
import { isTronChain } from '@/utils/tron-chains'
import { isTronWallet } from '@/utils/wallets'

const useConnectWallet = () => {
  const onboard = useOnboard()
  const router = useRouter()
  const urlChainId = useUrlChainId()

  return useCallback(async () => {
    if (!onboard) {
      return undefined
    }

    const wallets = await connectWallet(onboard)
    const wallet = wallets && getConnectedWallet(wallets)

    // The picked wallet is of the other chain family than the page: leave for one it can use.
    // A Safe goes to the accounts list; other pages drop the chain and follow the wallet's chain.
    if (wallet && urlChainId && isTronChain(urlChainId) !== isTronWallet(wallet)) {
      const { safe, chain: _chain, ...query } = router.query
      router.replace(safe ? AppRoutes.welcome.accounts : { pathname: router.pathname, query })
    }

    return wallets
  }, [onboard, router, urlChainId])
}

export default useConnectWallet
