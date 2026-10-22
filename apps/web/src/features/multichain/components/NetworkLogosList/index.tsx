import ChainIndicator from '@/components/common/ChainIndicator'
import ScrollableChainList from '@/components/common/ScrollableChainList'
import { Box } from '@mui/material'
import type { Chain } from '@safe-global/store/gateway/AUTO_GENERATED/chains'
import css from './styles.module.css'

const MAX_NUM_VISIBLE_CHAINS = 4
const DEFAULT_LOGO_SIZE = 24
const DEFAULT_MAX_HEIGHT = 80

type NetworkLogosListProps = {
  networks: Pick<Chain, 'chainId'>[]
  /** Dense mode: overlapping logos capped at 4 plus a "+N" indicator */
  showHasMore?: boolean
  logoSize?: number
  maxHeight?: number
  centered?: boolean
  fadeColor?: string
}

const NetworkLogosList = ({
  networks,
  showHasMore = false,
  logoSize = DEFAULT_LOGO_SIZE,
  maxHeight = DEFAULT_MAX_HEIGHT,
  centered = false,
  fadeColor,
}: NetworkLogosListProps) => {
  if (showHasMore) {
    return (
      <Box className={css.stacked}>
        {networks.slice(0, MAX_NUM_VISIBLE_CHAINS).map((chain) => (
          <ChainIndicator key={chain.chainId} chainId={chain.chainId} onlyLogo inline />
        ))}
        {networks.length > MAX_NUM_VISIBLE_CHAINS && (
          <Box className={css.moreChainsIndicator}>+{networks.length - MAX_NUM_VISIBLE_CHAINS}</Box>
        )}
      </Box>
    )
  }

  return (
    <ScrollableChainList maxHeight={maxHeight} centered={centered} fadeColor={fadeColor} data-testid="network-logos">
      {networks.map((chain) => (
        <ChainIndicator key={chain.chainId} chainId={chain.chainId} onlyLogo inline imageSize={logoSize} />
      ))}
    </ScrollableChainList>
  )
}

export default NetworkLogosList
