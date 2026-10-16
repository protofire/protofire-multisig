import partition from 'lodash/partition'
import type { Chain } from '@safe-global/store/gateway/AUTO_GENERATED/chains'

export interface CarouselLayout {
  networksPerRow: number
  rowsPerSlide: number
}

export const CAROUSEL_LAYOUT_MOBILE: CarouselLayout = { networksPerRow: 2, rowsPerSlide: 4 }
export const CAROUSEL_LAYOUT_TABLET: CarouselLayout = { networksPerRow: 3, rowsPerSlide: 4 }
export const CAROUSEL_LAYOUT_DESKTOP: CarouselLayout = { networksPerRow: 4, rowsPerSlide: 4 }
export const CAROUSEL_LAYOUT_WIDE: CarouselLayout = { networksPerRow: 5, rowsPerSlide: 4 }

export const getNetworksPerSlide = ({ networksPerRow, rowsPerSlide }: CarouselLayout): number =>
  networksPerRow * rowsPerSlide

export const NETWORKS_PER_ROW = CAROUSEL_LAYOUT_DESKTOP.networksPerRow
export const NETWORKS_PER_SLIDE = getNetworksPerSlide(CAROUSEL_LAYOUT_DESKTOP)

const COUNT_STEP = 10

export const formatNetworkCount = (count: number): string => {
  if (count < 10) return String(count)

  return `${Math.floor(count / COUNT_STEP) * COUNT_STEP}+`
}

export const formatNetworkCountLabel = (count: number): string => {
  if (count <= 0) return 'Multiple networks'
  if (count === 1) return '1 network'
  return `${formatNetworkCount(count)} networks`
}

export const groupNetworksMainnetsFirst = (chains: Chain[]): Chain[] => {
  const [mainnets, testnets] = partition(chains, (chain) => !chain.isTestnet)
  return [...mainnets, ...testnets]
}
