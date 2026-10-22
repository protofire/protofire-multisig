import useAsync from '@safe-global/utils/hooks/useAsync'
import { getHederaAccountId, getHederaNetwork, type HederaNetwork } from '@/utils/hedera'
import { useChain } from './useChains'

/**
 * Resolves a Hedera owner's native account id (`0.0.X`) from their 0x address, for display
 * alongside the address — the Hedera equivalent of Tron's base58 address (see `useTronAddress`).
 * Undefined on non-Hedera chains, or while the mirror-node lookup is in flight.
 */
const useHederaAccountId = (
  address: string,
  chainId: string,
): { accountId?: string; network?: HederaNetwork; isHedera: boolean } => {
  const network = getHederaNetwork(useChain(chainId))

  const [accountId] = useAsync(() => {
    if (!network) return undefined
    return getHederaAccountId(network, address)
  }, [network, address])

  return { accountId, network, isHedera: !!network }
}

export default useHederaAccountId
