import { ZERO_ADDRESS } from '@safe-global/protocol-kit/dist/src/utils/constants'
import type { Balances } from '@safe-global/store/gateway/AUTO_GENERATED/balances'
import type { AppBalance, Portfolio } from '@safe-global/store/gateway/AUTO_GENERATED/portfolios'
import type { NativeCurrency } from '@safe-global/store/gateway/AUTO_GENERATED/chains'

// Only the fields we actually need to identify a chain's native currency
export type NativeCurrencyIdentity = Pick<NativeCurrency, 'symbol' | 'decimals'>

export interface PortfolioBalances extends Balances {
  positions?: AppBalance[]
  tokensFiatTotal?: string
  positionsFiatTotal?: string
  isAllTokensMode?: boolean
}

export const initialBalancesState: PortfolioBalances = {
  items: [],
  fiatTotal: '',
}

export const createPortfolioBalances = (balances: Balances): PortfolioBalances => ({
  ...balances,
  tokensFiatTotal: balances.fiatTotal,
  positionsFiatTotal: '0',
  positions: undefined,
})

/**
 * Some token data providers (e.g. Zerion, behind the Portfolio endpoint) report a chain's
 * native currency as a regular ERC-20/ERC-721 entry at its real contract address instead of
 * this app's NATIVE_TOKEN sentinel (zero address) - e.g. Celo, whose native gas currency is
 * also a first-class ERC-20 contract. Native-token lookups elsewhere in the app rely on the
 * zero-address sentinel, so normalize any entry matching the chain's own nativeCurrency
 * config (symbol + decimals) rather than hardcoding specific chains/addresses. This keeps the
 * fix applicable to any chain with the same provider quirk, present or future.
 */
const normalizeNativeToken = <T extends { tokenInfo: { type: string; symbol: string; decimals: number } }>(
  items: T[],
  nativeCurrency?: NativeCurrencyIdentity,
): T[] => {
  if (!nativeCurrency) return items
  if (items.some((item) => item.tokenInfo.type === 'NATIVE_TOKEN')) return items

  return items.map((item) => {
    const { tokenInfo } = item
    const isMisreportedNativeCurrency =
      tokenInfo.type !== 'NATIVE_TOKEN' &&
      tokenInfo.symbol.toLowerCase() === nativeCurrency.symbol.toLowerCase() &&
      tokenInfo.decimals === nativeCurrency.decimals

    if (!isMisreportedNativeCurrency) return item

    return { ...item, tokenInfo: { ...tokenInfo, address: ZERO_ADDRESS, type: 'NATIVE_TOKEN' as const } }
  })
}

export const transformPortfolioToBalances = (
  portfolio?: Portfolio,
  nativeCurrency?: NativeCurrencyIdentity,
): PortfolioBalances | undefined => {
  if (!portfolio) return undefined

  const items = portfolio.tokenBalances.map((token) => ({
    tokenInfo: {
      ...token.tokenInfo,
      logoUri: token.tokenInfo.logoUri || '',
    },
    balance: token.balance,
    fiatBalance: token.balanceFiat || '0',
    fiatConversion: token.price || '0',
    fiatBalance24hChange: token.priceChangePercentage1d,
  }))

  return {
    items: normalizeNativeToken(items, nativeCurrency),
    fiatTotal: portfolio.totalBalanceFiat,
    tokensFiatTotal: portfolio.totalTokenBalanceFiat,
    positionsFiatTotal: portfolio.totalPositionsBalanceFiat,
    positions: portfolio.positionBalances,
  }
}

export const calculateTokensFiatTotal = (items: Balances['items']): string => {
  const total = items.reduce((sum, item) => sum + parseFloat(item.fiatBalance || '0'), 0)
  return total.toString()
}
