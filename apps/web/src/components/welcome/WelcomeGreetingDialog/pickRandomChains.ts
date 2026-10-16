import type { Chain } from '@safe-global/store/gateway/AUTO_GENERATED/chains'

type PickableChain = Pick<Chain, 'isTestnet' | 'chainLogoUri'>

export const pickRandomChains = <T extends PickableChain>(
  chains: T[],
  count: number,
  random: () => number = Math.random,
): T[] => {
  const pool = chains.filter((chain) => !chain.isTestnet && !!chain.chainLogoUri)

  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }

  return pool.slice(0, count)
}
