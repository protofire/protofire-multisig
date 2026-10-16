import { useMemo, useState } from 'react'
import type { Chain } from '@safe-global/store/gateway/AUTO_GENERATED/chains'
import { getGroupedFilteredChains, isChainVisible } from './utils'

export const useNetworkSearch = <T extends Chain>(chains: T[]) => {
  const [searchQuery, setSearchQuery] = useState('')

  const groups = useMemo(() => getGroupedFilteredChains(chains, searchQuery), [chains, searchQuery])
  const isSearching = searchQuery.trim().length > 0

  const resetSearch = () => setSearchQuery('')
  const isSelectedChainVisible = (chainId: string | undefined) => isChainVisible(groups, chainId)

  return {
    searchQuery,
    setSearchQuery,
    resetSearch,
    isSearching,
    groups,
    isSelectedChainVisible,
  }
}
