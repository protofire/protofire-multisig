import { useMemo } from 'react'
import useAsync from '@safe-global/utils/hooks/useAsync'
import useDebounce from '@safe-global/utils/hooks/useDebounce'
import { isHederaAccountId, getHederaEvmAddress, type HederaNetwork } from '@/utils/hedera'

/**
 * Resolves a native Hedera account id (`0.0.X`) typed into the recipient field to its 0x EVM
 * address, via the public mirror-node REST API — the Hedera equivalent of `useNameResolver`'s
 * ENS resolution.
 */
const useHederaAccountIdResolver = (
  value: string,
  network?: HederaNetwork,
): { address: string | undefined; resolverError?: Error; resolving: boolean } => {
  const debouncedValue = useDebounce((value || '').trim(), 200)

  const [address, resolverError, isResolving] = useAsync<string | undefined>(() => {
    if (!network || !isHederaAccountId(debouncedValue)) return
    return getHederaEvmAddress(network, debouncedValue)
  }, [network, debouncedValue])

  const resolving = isResolving && !!network && isHederaAccountId(debouncedValue)

  return useMemo(() => ({ address, resolverError, resolving }), [address, resolverError, resolving])
}

export default useHederaAccountIdResolver
