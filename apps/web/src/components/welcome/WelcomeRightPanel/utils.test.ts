import {
  CAROUSEL_LAYOUT_DESKTOP,
  CAROUSEL_LAYOUT_MOBILE,
  formatNetworkCount,
  formatNetworkCountLabel,
  getNetworksPerSlide,
  groupNetworksMainnetsFirst,
} from './utils'
import type { Chain } from '@safe-global/store/gateway/AUTO_GENERATED/chains'

const createChain = (chainId: string, chainName: string, isTestnet = false): Chain =>
  ({
    chainId,
    chainName,
    isTestnet,
  }) as Chain

describe('groupNetworksMainnetsFirst', () => {
  it('moves testnets after mainnets while preserving the incoming relevance order', () => {
    const chains = [
      createChain('1', 'Ethereum'),
      createChain('11155111', 'Sepolia', true),
      createChain('8453', 'Base'),
      createChain('84532', 'Base Sepolia', true),
      createChain('42161', 'Arbitrum'),
    ]

    expect(groupNetworksMainnetsFirst(chains).map((chain) => chain.chainName)).toEqual([
      'Ethereum',
      'Base',
      'Arbitrum',
      'Sepolia',
      'Base Sepolia',
    ])
  })

  it('does not mutate the input', () => {
    const chains = [createChain('1', 'B', true), createChain('2', 'A')]
    groupNetworksMainnetsFirst(chains)

    expect(chains.map((chain) => chain.chainName)).toEqual(['B', 'A'])
  })
})

describe('formatNetworkCount', () => {
  it('returns the exact count below ten', () => {
    expect(formatNetworkCount(3)).toBe('3')
    expect(formatNetworkCount(9)).toBe('9')
  })

  it('always floors to the nearest ten', () => {
    expect(formatNetworkCount(17)).toBe('10+')
    expect(formatNetworkCount(78)).toBe('70+')
    expect(formatNetworkCount(100)).toBe('100+')
    expect(formatNetworkCount(187)).toBe('180+')
    expect(formatNetworkCount(230)).toBe('230+')
  })
})

describe('formatNetworkCountLabel', () => {
  it('returns a fallback label for zero or negative counts', () => {
    expect(formatNetworkCountLabel(0)).toBe('Multiple networks')
    expect(formatNetworkCountLabel(-1)).toBe('Multiple networks')
  })

  it('returns the exact count below ten', () => {
    expect(formatNetworkCountLabel(1)).toBe('1 network')
    expect(formatNetworkCountLabel(9)).toBe('9 networks')
  })

  it('floors counts between 10 and 99 to the nearest ten', () => {
    expect(formatNetworkCountLabel(64)).toBe('60+ networks')
    expect(formatNetworkCountLabel(96)).toBe('90+ networks')
    expect(formatNetworkCountLabel(17)).toBe('10+ networks')
  })

  it('floors counts of 100 or more to the nearest ten', () => {
    expect(formatNetworkCountLabel(100)).toBe('100+ networks')
    expect(formatNetworkCountLabel(156)).toBe('150+ networks')
    expect(formatNetworkCountLabel(200)).toBe('200+ networks')
  })
})

describe('getNetworksPerSlide', () => {
  it('multiplies the rows of a layout by its networks per row', () => {
    expect(getNetworksPerSlide(CAROUSEL_LAYOUT_DESKTOP)).toBe(16)
    expect(getNetworksPerSlide(CAROUSEL_LAYOUT_MOBILE)).toBe(8)
  })
})
