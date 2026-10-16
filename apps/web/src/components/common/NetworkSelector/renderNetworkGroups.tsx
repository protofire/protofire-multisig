import type { ReactNode } from 'react'
import type { Chain } from '@safe-global/store/gateway/AUTO_GENERATED/chains'
import NetworkGroupDivider from './NetworkGroupDivider'
import { NETWORK_GROUP, type GroupedFilteredChains } from './utils'

/**
 * Returns a flat array (not a Fragment) so the items stay direct children of MUI `Select`,
 * which needs to clone them to inject `selected`/`onClick`.
 */
export const renderNetworkGroups = <T extends Chain>(
  { prodNets, testNets, showMainnetsDivider, showTestnetsDivider }: GroupedFilteredChains<T>,
  renderItem: (chain: T) => ReactNode,
): ReactNode[] => [
  showMainnetsDivider && <NetworkGroupDivider key="mainnets-divider" label={NETWORK_GROUP.mainnets} />,
  ...prodNets.map(renderItem),
  showTestnetsDivider && <NetworkGroupDivider key="testnets-divider" label={NETWORK_GROUP.testnets} />,
  ...testNets.map(renderItem),
]
