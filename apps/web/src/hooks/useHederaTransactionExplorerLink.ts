import { getHederaNetwork, getHederaTransactionExplorerLink } from '@/utils/hedera'
import { useCurrentChain } from './useChains'

/**
 * HashScan link for a transaction the backend reports a native Hedera transaction id for (only
 * native, non-EVM transfers have one). Undefined for every other transaction and on non-Hedera
 * chains, so callers can fall back to the regular `txHash` explorer link.
 */
const useHederaTransactionExplorerLink = (
  hederaTransactionId?: string,
): { href: string; title: string } | undefined => {
  const network = getHederaNetwork(useCurrentChain())

  if (!hederaTransactionId || !network) return undefined

  const href = getHederaTransactionExplorerLink(network, hederaTransactionId)
  return { href, title: `View on ${new URL(href).hostname}` }
}

export default useHederaTransactionExplorerLink
