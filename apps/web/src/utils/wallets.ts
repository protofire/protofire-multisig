import type { EthersError } from '@/utils/ethers-utils'
import { getWalletConnectLabel, type ConnectedWallet } from '@/hooks/wallets/useOnboard'
import { getWeb3ReadOnly } from '@/hooks/wallets/web3ReadOnly'
import { WALLET_KEYS } from '@/hooks/wallets/consts'
// Inlined to avoid importing from protocol-kit which has heavy dependencies
const EMPTY_DATA = '0x'
import memoize from 'lodash/memoize'
import { isTronChain } from '@/utils/tron-chains'
import { PRIVATE_KEY_MODULE_LABEL } from '@/services/private-key-module/constants'
import { type JsonRpcProvider } from 'ethers'

const WALLETCONNECT = 'WalletConnect'
const WC_LEDGER = 'Ledger Wallet'
export const EIP_7702_DELEGATED_ACCOUNT_PREFIX = '0xef0100'

const isWCRejection = (err: Error): boolean => {
  return /rejected/.test(err?.message)
}

const isEthersRejection = (err: EthersError): boolean => {
  return err.code === 'ACTION_REJECTED'
}

export const isWalletRejection = (err: EthersError | Error): boolean => {
  return isEthersRejection(err as EthersError) || isWCRejection(err)
}

export const isHashPackWallet = (walletLabel: string): boolean => walletLabel.toUpperCase() === WALLET_KEYS.HASHPACK

export const isEthSignWallet = (wallet: ConnectedWallet): boolean => {
  return [WALLET_KEYS.TREZOR, WALLET_KEYS.KEYSTONE].includes(wallet.label.toUpperCase() as WALLET_KEYS)
}

export const isLedgerLive = (wallet: ConnectedWallet): boolean => {
  return getWalletConnectLabel(wallet) === WC_LEDGER
}

export const isLedger = (wallet: ConnectedWallet): boolean => {
  return wallet.label.toUpperCase() === WALLET_KEYS.LEDGER || isLedgerLive(wallet)
}

export const isWalletConnect = (wallet: ConnectedWallet): boolean => {
  return wallet.label.toLowerCase().startsWith(WALLETCONNECT.toLowerCase())
}

export const isHardwareWallet = (wallet: ConnectedWallet): boolean => {
  return [WALLET_KEYS.LEDGER, WALLET_KEYS.TREZOR, WALLET_KEYS.KEYSTONE].includes(
    wallet.label.toUpperCase() as WALLET_KEYS,
  )
}

export const isTronWallet = (wallet: Pick<ConnectedWallet, 'label'>): boolean => {
  return wallet.label.toUpperCase() === WALLET_KEYS.TRONLINK
}

export const isPKWallet = (wallet: ConnectedWallet): boolean => {
  return wallet.label.toUpperCase() === WALLET_KEYS.PK
}

const getAccountCode = async (address: string, provider?: JsonRpcProvider): Promise<string> => {
  const web3 = provider ?? getWeb3ReadOnly()

  if (!web3) {
    throw new Error('Provider not found')
  }

  return await web3.getCode(address)
}

export const isSmartContract = async (address: string, provider?: JsonRpcProvider): Promise<boolean> => {
  const code = await getAccountCode(address, provider)
  return code !== EMPTY_DATA
}

export const isEIP7702DelegatedAccount = async (address: string, provider?: JsonRpcProvider): Promise<boolean> => {
  const code = await getAccountCode(address, provider)
  return code.startsWith(EIP_7702_DELEGATED_ACCOUNT_PREFIX)
}

const TRON_GET_CODE_ATTEMPTS = 3
const TRON_GET_CODE_BACKOFF_MS = 1500

// TronGrid may 429 without CORS headers, which the browser surfaces as a
// generic fetch failure. Retry with backoff; `undefined` means every attempt
// failed and the result is unknown, distinct from a confirmed EOA (`false`).
const isTronSmartContractWallet = async (address: string): Promise<boolean | undefined> => {
  for (let attempt = 0; attempt < TRON_GET_CODE_ATTEMPTS; attempt++) {
    try {
      return await isSmartContract(address)
    } catch {
      await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * TRON_GET_CODE_BACKOFF_MS))
    }
  }
  return undefined
}

export const isSmartContractWallet = memoize(
  async (chainId: string, address: string): Promise<boolean> => {
    // No EIP-7702 on Tron; a single guarded getCode call avoids TronGrid rate limits.
    // TronLink signers are always EOAs, so an unknown result is assumed to be an EOA
    // here — throwing would block the whole signing/execution flow for the connected
    // wallet. Callers that need to tell "confirmed EOA" apart from "unknown" for a
    // security-relevant signal (e.g. an arbitrary user-supplied address) should use
    // `getSmartContractWalletStatus` instead.
    if (isTronChain(chainId)) {
      return (await isTronSmartContractWallet(address)) ?? false
    }
    const isContract = await isSmartContract(address)
    const isEIP7702 = await isEIP7702DelegatedAccount(address)
    return isContract && !isEIP7702
  },
  (chainId, address) => chainId + address,
)

export type SmartContractWalletStatus = 'contract' | 'eoa' | 'unknown'

// Tri-state variant of `isSmartContractWallet` for callers where silently treating
// an unresolved Tron contract-code lookup as "confirmed EOA" would hide a
// security-relevant signal (e.g. a recoverer address warning).
export const getSmartContractWalletStatus = async (
  chainId: string,
  address: string,
): Promise<SmartContractWalletStatus> => {
  if (isTronChain(chainId)) {
    const result = await isTronSmartContractWallet(address)
    if (result === undefined) return 'unknown'
    return result ? 'contract' : 'eoa'
  }
  const isContract = await isSmartContract(address)
  const isEIP7702 = await isEIP7702DelegatedAccount(address)
  return isContract && !isEIP7702 ? 'contract' : 'eoa'
}

/* Check if the wallet is unlocked. */
export const isWalletUnlocked = async (walletName: string): Promise<boolean | undefined> => {
  // HashPack is a WalletConnect-based module — "unlocked" isn't meaningful for it a persisted
  // session either exists or it doesn't.
  if ([PRIVATE_KEY_MODULE_LABEL, WALLETCONNECT].includes(walletName) || isHashPackWallet(walletName)) return true

  // TronLink: check if the extension is available and has a connected address
  if (walletName === 'TronLink') {
    if (typeof window === 'undefined') return false
    const tw = window.tronLink?.tronWeb || window.tronWeb
    // Must be a strict boolean: `undefined` (no tronWeb yet) is read by connectLastWallet as
    // "unknown, try autoconnect with modals enabled" — but the TronLink module returns null
    // without window.tronLink, so that autoconnect would open a wallet modal that never closes.
    return !!(tw?.ready && tw?.defaultAddress?.hex)
  }

  const METAMASK_LIKE = ['MetaMask', 'Rabby Wallet', 'Zerion', 'Ambire']

  // Only MetaMask exposes a method to check if the wallet is unlocked
  if (METAMASK_LIKE.includes(walletName)) {
    if (typeof window === 'undefined' || !window.ethereum?._metamask) return false
    try {
      return await window.ethereum?._metamask.isUnlocked()
    } catch {
      return false
    }
  }

  return false
}
