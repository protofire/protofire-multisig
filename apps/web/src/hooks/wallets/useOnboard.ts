import { useEffect } from 'react'
import { type WalletState, type OnboardAPI } from '@web3-onboard/core'
import { type Chain } from '@safe-global/store/gateway/AUTO_GENERATED/chains'
import type { Eip1193Provider } from 'ethers'
import { getAddress } from 'viem'
import useChains, { useCurrentChain } from '@/hooks/useChains'
import ExternalStore from '@safe-global/utils/services/ExternalStore'
import { logError, Errors } from '@/services/exceptions'
import { trackEvent, WALLET_EVENTS, MixpanelEventParams } from '@/services/analytics'
import { useAppSelector, useAppDispatch } from '@/store'
import { selectRpc } from '@/store/settingsSlice'
import { formatAmount } from '@safe-global/utils/utils/formatNumber'
import { isTronChain } from '@/utils/tron'
import { localItem } from '@/services/local-storage/local'
import { isTronWallet, isWalletConnect, isWalletUnlocked } from '@/utils/wallets'
import { useUrlChainId } from '@/hooks/useChainId'
import { setUnauthenticated } from '@/store/authSlice'
import type { EnvState } from '@safe-global/store/settingsSlice'
import { getTronChainIds } from '@/utils/tron-chains'
import {
  TRONLINK_MODULE_LABEL,
  isTronLinkOnSupportedNetwork,
  onTronLinkReady,
} from '@/services/onboard/tronlink-module'

export type ConnectedWallet = {
  label: string
  chainId: string
  address: string
  ens?: string
  provider: Eip1193Provider
  icon?: string
  balance?: string
  isProposer?: boolean
}

const { getStore, setStore, useStore } = new ExternalStore<OnboardAPI>()

const { setStore: setWalletReady, useStore: useIsWalletReady } = new ExternalStore<boolean>()

export { useIsWalletReady }

export const initOnboard = async (
  chainConfigs: Chain[],
  currentChain: Chain,
  rpcConfig: EnvState['rpc'] | undefined,
) => {
  const { createOnboard } = await import('@/services/onboard')
  if (!getStore()) {
    setStore(createOnboard(chainConfigs, currentChain, rpcConfig))
  }
}

// Get the most recently connected wallet address
export const getConnectedWallet = (wallets: WalletState[]): ConnectedWallet | null => {
  if (!wallets) return null

  const primaryWallet = wallets[0]
  if (!primaryWallet) return null

  const account = primaryWallet.accounts[0]
  if (!account) return null

  let balance = ''
  if (account.balance) {
    const tokenBalance = Object.entries(account.balance)[0]
    const token = tokenBalance?.[0] || ''
    const balanceString = tokenBalance?.[1] || ''
    const balanceNumber = parseFloat(balanceString)
    if (Number.isNaN(balanceNumber)) {
      balance = balanceString
    } else {
      // web3-onboard always formats balances assuming 18 decimals (ETH).
      // For Tron (6 decimals), the displayed value is 10^12 times too small.
      // Re-scale: multiply by 10^(18-6) = 10^12 to get the correct value.
      const chainId = Number(primaryWallet.chains[0]?.id).toString(10)
      const correctedBalance = isTronChain(chainId) ? balanceNumber * 1e12 : balanceNumber
      const balanceFormatted = formatAmount(correctedBalance)
      balance = `${balanceFormatted} ${token}`
    }
  }

  try {
    const address = getAddress(account.address)
    return {
      label: primaryWallet.label,
      address,
      ens: account.ens?.name,
      chainId: Number(primaryWallet.chains[0].id).toString(10),
      provider: primaryWallet.provider,
      icon: primaryWallet.icon,
      balance,
      isProposer: false,
    }
  } catch (e) {
    logError(Errors._106, e)
    return null
  }
}

export const getWalletConnectLabel = (wallet: ConnectedWallet): string | undefined => {
  const UNKNOWN_PEER = 'Unknown'
  if (!isWalletConnect(wallet)) return
  const { connector } = wallet.provider as unknown as any
  const peerWalletV2 = connector.session?.peer?.metadata?.name
  return peerWalletV2 || UNKNOWN_PEER
}

export const trackWalletType = (wallet: ConnectedWallet, configs: Chain[]) => {
  const chainInfo = configs.find((config) => config.chainId === wallet.chainId)
  const networkName = chainInfo?.chainName || `Chain ${wallet.chainId}`

  trackEvent(
    { ...WALLET_EVENTS.CONNECT, label: wallet.label },
    {
      [MixpanelEventParams.EOA_WALLET_LABEL]: wallet.label,
      [MixpanelEventParams.EOA_WALLET_ADDRESS]: wallet.address,
      [MixpanelEventParams.EOA_WALLET_NETWORK]: networkName,
    },
  )

  const wcLabel = getWalletConnectLabel(wallet)
  if (wcLabel) {
    trackEvent({
      ...WALLET_EVENTS.WALLET_CONNECT,
      label: wcLabel,
    })
  }
}

let isConnecting = false

// Wrapper that tracks/sets the last used wallet
export const connectWallet = async (
  onboard: OnboardAPI,
  options?: Parameters<OnboardAPI['connectWallet']>[0],
): Promise<WalletState[] | undefined> => {
  if (isConnecting) {
    return
  }

  isConnecting = true

  let wallets: WalletState[] | undefined

  try {
    wallets = await onboard.connectWallet(options)
  } catch (e) {
    logError(Errors._107, e)
    isConnecting = false

    return
  }

  isConnecting = false

  return wallets
}

export const switchWallet = async (onboard: OnboardAPI) => {
  await connectWallet(onboard)
}

const lastWalletStorage = localItem<string>('lastWallet')

const connectLastWallet = async (onboard: OnboardAPI, urlChainId: string | undefined, tronChainIds: string[]) => {
  const lastWalletLabel = lastWalletStorage.get()
  // A link to a chain of the other family wins over the last wallet: don't reconnect a wallet that can't use it
  const isOtherFamily =
    !!lastWalletLabel && !!urlChainId && isTronChain(urlChainId) !== isTronWallet({ label: lastWalletLabel })
  if (lastWalletLabel && !isOtherFamily) {
    const isUnlocked = await isWalletUnlocked(lastWalletLabel)

    // A silent (disableModals: true) autoSelect whose getInterface throws never settles in
    // onboard core, permanently wedging connectWallet's isConnecting flag. TronLink's
    // getInterface throws when it's unlocked but pointed at an unsupported network, so skip
    // the silent reconnect for that case entirely rather than risk it.
    if (
      lastWalletLabel === TRONLINK_MODULE_LABEL &&
      isUnlocked === true &&
      !isTronLinkOnSupportedNetwork(tronChainIds)
    ) {
      return
    }

    if (isUnlocked === true || isUnlocked === undefined) {
      connectWallet(onboard, {
        autoSelect: { label: lastWalletLabel, disableModals: isUnlocked || false },
      })
    }
  }
}

const saveLastWallet = (walletLabel: string) => {
  lastWalletStorage.set(walletLabel)
}

// Disable/enable wallets according to chain
export const useInitOnboard = () => {
  const { configs, isRuntimeData } = useChains()
  const chain = useCurrentChain()
  const urlChainId = useUrlChainId()
  const onboard = useStore()
  const customRpc = useAppSelector(selectRpc)
  const dispatch = useAppDispatch()

  useEffect(() => {
    // Init off the snapshot immediately — the chains fetch retries for ~2 min on a CGW blip
    // (packages/store/src/gateway/chains/index.ts), and the picker/module list re-run anyway
    // once `configs` updates to the runtime data (see the effect below), so there's no reason
    // to leave "Connect wallet" dead while waiting for that fetch to settle.
    if (configs.length > 0 && chain) {
      void initOnboard(configs, chain, customRpc)
    }
  }, [configs, chain, customRpc])

  // Disable unsupported wallets on the current chain
  useEffect(() => {
    if (!onboard || !chain) return

    let cancelled = false
    const tronChainIds = getTronChainIds(configs)
    const hadTronLink = typeof window !== 'undefined' && !!window.tronLink

    const enableWallets = async () => {
      const { getAllWallets } = await import('@/hooks/wallets/wallets')
      const supportedWallets = getAllWallets(chain, configs)
      onboard.state.actions.setWalletModules(supportedWallets)
    }

    const firstPass = enableWallets().then(async () => {
      // Silent auto-reconnect must wait for the runtime chains fetch to settle (fulfilled, or
      // rejected and falling back to the snapshot) — reconnecting off snapshot-only config-service
      // features would wire the wallet up before those features are visible.
      // The module list above is fine off the snapshot since it just re-runs when configs updates.
      if (!isRuntimeData) return

      // Reconnect last wallet and mark wallet provider as ready
      await connectLastWallet(onboard, urlChainId, tronChainIds)

      setWalletReady(true)
    })

    // TronLink's extension can inject window.tronLink seconds after navigation (MV3 service
    // worker cold start), after the computation above already ran without it. Re-run once it
    // shows up so the picker/reconnect aren't stuck without TronLink until the next chain
    // change. Doesn't gate setWalletReady — that's set inside firstPass once the runtime chains
    // fetch has settled, independently of TronLink. Chained off firstPass so the re-run doesn't
    // race the initial setWalletModules/connectLastWallet.
    let unsubscribe = () => {}
    if (tronChainIds.length > 0 && !hadTronLink) {
      unsubscribe = onTronLinkReady(() => {
        firstPass.then(async () => {
          if (cancelled) return
          await enableWallets()
          // An already-open connect modal snapshots the module list, so a user who opened it
          // before TronLink injected has to close/reopen it (onboard has no public refresh);
          // also skip if a wallet connected while we waited (nothing to reconnect), and wait for
          // runtime data for the same reason as the silent reconnect above.
          if (cancelled || !isRuntimeData || onboard.state.get().wallets.length > 0) return
          await connectLastWallet(onboard, urlChainId, tronChainIds)
        })
      })
    }

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [chain, urlChainId, onboard, configs, isRuntimeData])

  // Track connected wallet
  useEffect(() => {
    let lastConnectedWallet = ''
    if (!onboard) return

    const walletSubscription = onboard.state.select('wallets').subscribe((wallets) => {
      const newWallet = getConnectedWallet(wallets)
      if (newWallet) {
        if (newWallet.label !== lastConnectedWallet) {
          lastConnectedWallet = newWallet.label
          saveLastWallet(lastConnectedWallet)
          trackWalletType(newWallet, configs)
        }
      } else if (lastConnectedWallet) {
        lastConnectedWallet = ''
        saveLastWallet(lastConnectedWallet)
        dispatch(setUnauthenticated())
      }
    })

    return () => {
      walletSubscription.unsubscribe()
    }
  }, [onboard, dispatch, configs])
}

export default useStore
