import { WC_PROJECT_ID } from '@/config/constants'
import type { Chain } from '@safe-global/store/gateway/AUTO_GENERATED/chains'
import type { InitOptions } from '@web3-onboard/core'
import coinbaseModule from '@web3-onboard/coinbase'
import injectedWalletModule, { ProviderLabel } from '@web3-onboard/injected-wallets'
import walletConnect from '@web3-onboard/walletconnect'
import pkModule from '@/services/private-key-module'
import { ledgerModule } from '@/services/onboard/ledger-module'
import tronlinkModule, { TRONLINK_MODULE_LABEL } from '@/services/onboard/tronlink-module'
import { FEATURES, hasFeature } from '@safe-global/utils/utils/chains'
import { getTronChains, isTronChain } from '@/utils/tron-chains'
import hashpackModule from '@/services/onboard/hashpack-module'

import { CGW_NAMES, WALLET_KEYS } from './consts'

const prefersDarkMode = (): boolean => {
  return window?.matchMedia('(prefers-color-scheme: dark)')?.matches
}

type WalletInits = InitOptions['wallets']
type WalletInit = WalletInits extends Array<infer U> ? U : never

const walletConnectV2 = (chain: Chain) => {
  // WalletConnect v2 requires a project ID
  if (!WC_PROJECT_ID) {
    return () => null
  }

  return walletConnect({
    version: 2,
    projectId: WC_PROJECT_ID,
    qrModalOptions: {
      themeVariables: {
        '--wcm-z-index': '1302',
      },
      themeMode: prefersDarkMode() ? 'dark' : 'light',
    },
    requiredChains: [parseInt(chain.chainId)],
    dappUrl: location.origin,
  })
}

// TronLink 5.x also announces an EVM provider via EIP-6963 (info.name === 'TronLink'), which
// the injected-wallets module would otherwise list as a duplicate "TronLink" entry that
// connects an Ethereum account instead of the native module below. When TronLink is the only
// EVM-shaped provider around, injected-wallets also falls back to a generic "Detected Wallet"
// entry backed by that same window.ethereum — hide that one too.
const injected = () => {
  const filter: Record<string, boolean> = { [TRONLINK_MODULE_LABEL]: false }
  if (typeof window !== 'undefined' && window.ethereum?.isTronLink) {
    filter[ProviderLabel.Detected] = false
  }
  return injectedWalletModule({ filter })
}

const WALLET_MODULES: Partial<{ [_key in WALLET_KEYS]: (chain: Chain, tronChains: Chain[]) => WalletInit }> = {
  [WALLET_KEYS.INJECTED]: () => injected() as WalletInit,
  [WALLET_KEYS.WALLETCONNECT_V2]: (chain) => walletConnectV2(chain) as WalletInit,
  [WALLET_KEYS.COINBASE]: () => coinbaseModule({ darkMode: prefersDarkMode() }) as WalletInit,
  [WALLET_KEYS.LEDGER]: () => ledgerModule(),
  [WALLET_KEYS.PK]: (chain) => pkModule(chain.chainId, chain.rpcUri) as WalletInit,
  [WALLET_KEYS.TRONLINK]: (chain, tronChains) => tronlinkModule(chain.chainId, tronChains) as WalletInit,
  [WALLET_KEYS.HASHPACK]: (chain) => hashpackModule(chain) as WalletInit,
}

// Wallets of both chain families, each as its chain config allows, so the user can always pick a
// wallet of the other family. ponytail: the first config of that family stands in for all of it.
export const getAllWallets = (chain: Chain, configs: Chain[]): WalletInits => {
  const otherFamilyChain = configs.find(
    (config) => isTronChain(config.chainId) !== isTronChain(chain.chainId) && !hasFeature(config, FEATURES.HEDERA),
  )
  return [
    ...getSupportedWallets(chain, configs),
    ...(otherFamilyChain ? getSupportedWallets(otherFamilyChain, configs) : []),
  ]
}

export const isWalletSupported = (disabledWallets: string[], walletLabel: string): boolean => {
  const legacyWalletName = CGW_NAMES?.[walletLabel.toUpperCase() as WALLET_KEYS]
  return !disabledWallets.includes(legacyWalletName || walletLabel)
}

export const getSupportedWallets = (chain: Chain, configs: Chain[]): WalletInits => {
  const tronChains = getTronChains(configs)

  if (hasFeature(chain, FEATURES.TRON)) {
    if (!isWalletSupported(chain.disabledWallets, WALLET_KEYS.TRONLINK)) {
      return []
    }
    const tronModule = WALLET_MODULES[WALLET_KEYS.TRONLINK]?.(chain, tronChains)
    return tronModule ? [tronModule] : []
  }

  // Hedera chains only ever offer HashPack plus a plain injected wallet (MetaMask, ECDSA-only,
  // talking directly to Hashio) — never fall through to the full generic wallet list below.
  // EIP-6963 support is disabled on the injected module specifically because HashPack also
  // announces itself as a plain EIP-6963 injected provider (MetaMask-style EVM emulation),
  // which would otherwise get auto-detected as a second, ECDSA-only "HashPack" entry alongside
  // the real module above. MetaMask still gets picked up via its legacy
  // `window.ethereum.isMetaMask` flag, which injected-wallets checks regardless of EIP-6963.
  if (hasFeature(chain, FEATURES.HEDERA)) {
    const hashpack = WALLET_MODULES[WALLET_KEYS.HASHPACK]?.(chain, tronChains)
    const hederaInjected = injectedWalletModule({ disable6963Support: true }) as WalletInit
    return hashpack ? [hashpack, hederaInjected] : [hederaInjected]
  }

  const enabledWallets = Object.entries(WALLET_MODULES).filter(
    ([key]) => key !== WALLET_KEYS.HASHPACK && isWalletSupported(chain.disabledWallets, key),
  )

  if (enabledWallets.length === 0) {
    return [injected()]
  }

  return enabledWallets.map(([, module]) => module(chain, tronChains))
}
