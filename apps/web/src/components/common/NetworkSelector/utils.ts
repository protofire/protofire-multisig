import partition from 'lodash/partition'
import type { Chain } from '@safe-global/store/gateway/AUTO_GENERATED/chains'

export const NETWORK_GROUP = {
  mainnets: 'Mainnets',
  testnets: 'Testnets',
} as const

export type NetworkGroup = (typeof NETWORK_GROUP)[keyof typeof NETWORK_GROUP]

const matchesQuery = (chain: Chain, normalizedQuery: string): boolean =>
  [chain.chainName, chain.shortName, chain.chainId].some((field) => field.toLowerCase().includes(normalizedQuery))

export const filterChainsByName = <T extends Chain>(chains: T[], query: string): T[] => {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return chains

  return chains.filter((chain) => matchesQuery(chain, normalizedQuery))
}

export const getNetworkGroup = (chain: Chain): NetworkGroup =>
  chain.isTestnet ? NETWORK_GROUP.testnets : NETWORK_GROUP.mainnets

export type GroupedFilteredChains<T extends Chain> = {
  prodNets: T[]
  testNets: T[]
  showMainnetsDivider: boolean
  showTestnetsDivider: boolean
  hasResults: boolean
}

export const getGroupedFilteredChains = <T extends Chain>(chains: T[], query: string): GroupedFilteredChains<T> => {
  const filteredChains = filterChainsByName(chains, query)
  const [testNets, prodNets] = partition(filteredChains, (config) => config.isTestnet)
  const hasTestnetsInList = chains.some((config) => config.isTestnet)

  return {
    prodNets,
    testNets,
    showMainnetsDivider: prodNets.length > 0 && hasTestnetsInList,
    showTestnetsDivider: testNets.length > 0,
    hasResults: filteredChains.length > 0,
  }
}

export const isChainVisible = <T extends Chain>(
  { prodNets, testNets }: GroupedFilteredChains<T>,
  chainId: string | undefined,
): boolean => Boolean(chainId) && [...prodNets, ...testNets].some((chain) => chain.chainId === chainId)
