import useWallet from '@/hooks/wallets/useWallet'
import { isHashPackWallet } from '@/utils/wallets'

export const OFF_CHAIN_SIGNATURES_UNSUPPORTED =
  "HashPack can't create off-chain signatures. Connect an ECDSA wallet such as MetaMask to manage proposers."

export const PROPOSE_OFF_CHAIN_SIGNATURES_UNSUPPORTED =
  "HashPack can't create off-chain signatures, so it can't propose transactions. Connect a proposer's ECDSA wallet such as MetaMask."

/**
 * Whether the connected wallet can sign EVM messages / EIP-712 typed data. HashPack only signs
 * native Hedera transactions, so off-chain actions (e.g. proposer delegations) can't use it.
 */
const useSupportsOffChainSignatures = (): boolean => {
  const wallet = useWallet()
  return !wallet || !isHashPackWallet(wallet.label)
}

export default useSupportsOffChainSignatures
