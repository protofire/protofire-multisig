import type { Chain } from '@safe-global/store/gateway/AUTO_GENERATED/chains'
import { getTronChains, getTronChainIds } from '../tron-chains'

const tronChain = { chainId: '728126428', features: [] } as unknown as Chain
const evmChain = { chainId: '1', features: [] } as unknown as Chain

describe('getTronChains', () => {
  it('returns only Tron chains', () => {
    expect(getTronChains([tronChain, evmChain])).toEqual([tronChain])
  })

  it('returns an empty array when no chains are Tron', () => {
    expect(getTronChains([evmChain])).toEqual([])
  })
})

describe('getTronChainIds', () => {
  it('returns the chain ids of Tron chains', () => {
    expect(getTronChainIds([tronChain, evmChain])).toEqual(['728126428'])
  })
})
