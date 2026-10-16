import { pickRandomChains } from './pickRandomChains'

const chain = (chainId: string, overrides: { isTestnet?: boolean; chainLogoUri?: string | null } = {}) => ({
  chainId,
  isTestnet: false,
  chainLogoUri: `https://logo/${chainId}.png`,
  ...overrides,
})

describe('pickRandomChains', () => {
  const chains = Array.from({ length: 20 }, (_, i) => chain(String(i)))

  it('returns the requested number of chains', () => {
    expect(pickRandomChains(chains, 8)).toHaveLength(8)
  })

  it('returns all eligible chains when there are fewer than requested', () => {
    expect(pickRandomChains([chain('1'), chain('2')], 8)).toHaveLength(2)
  })

  it('excludes testnets and chains without a logo', () => {
    const picked = pickRandomChains(
      [chain('1'), chain('2', { isTestnet: true }), chain('3', { chainLogoUri: null }), chain('4')],
      8,
    )

    expect(picked.map((c) => c.chainId).sort()).toEqual(['1', '4'])
  })

  it('returns distinct chains and does not mutate the input', () => {
    const snapshot = chains.map((c) => c.chainId)
    const picked = pickRandomChains(chains, 8)

    expect(new Set(picked.map((c) => c.chainId)).size).toBe(8)
    expect(chains.map((c) => c.chainId)).toEqual(snapshot)
  })

  it('picks different chains depending on the random source', () => {
    const first = pickRandomChains(chains, 8, () => 0)
    const second = pickRandomChains(chains, 8, () => 0.99)

    expect(first.map((c) => c.chainId)).not.toEqual(second.map((c) => c.chainId))
  })
})
