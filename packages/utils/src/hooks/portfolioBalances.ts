import { ZERO_ADDRESS } from '@safe-global/protocol-kit/dist/src/utils/constants'
import type { Balance, Balances } from '@safe-global/store/gateway/AUTO_GENERATED/balances'
import type { AppBalance, Portfolio } from '@safe-global/store/gateway/AUTO_GENERATED/portfolios'
import type { NativeCurrency } from '@safe-global/store/gateway/AUTO_GENERATED/chains'
import { TokenType } from '@safe-global/store/gateway/types'

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

// Hashio (Hedera's EVM JSON-RPC relay) reports the native HBAR balance — both via
// `eth_getBalance` directly, and via the CGW `/balances` endpoint that derives from it — in the
// standard 18-decimal "weibar" convention. That's a JSON-RPC wire-format quirk, applied only at
// the relay boundary for EVM-tooling compatibility (eth_getBalance, gas price, msg.value of the
// *outer* transaction) — it does NOT apply inside the EVM itself: `.balance`, `msg.value`, and
// any `.call{value: v}(...)` a contract performs all operate in Hedera's real, native tinybar
// (8-decimal) unit. Convert the *raw balance number* down to tinybar here, once, rather than
// the token's `decimals` metadata (which is already correctly 8) — that keeps `balance` and
// `decimals` paired correctly for every consumer, whether it's just displaying the balance or
// using it to construct an actual transfer's on-chain value.
const HEDERA_WEIBAR_TO_TINYBAR = 10n ** 10n

// CGW prices the native item from that same weibar number but divides by the 8 native decimals,
// inflating `fiatBalance` (and `fiatTotal`) by 10^10. Re-deriving it from the per-unit
// `fiatConversion` and the tinybar balance is correct whether or not CGW already fixed it.
const toTinybarNativeItem = (item: Balance): Balance => {
  const balance = BigInt(item.balance) / HEDERA_WEIBAR_TO_TINYBAR
  const fiatBalance = (Number(balance) / 10 ** item.tokenInfo.decimals) * Number(item.fiatConversion || 0)
  return { ...item, balance: balance.toString(), fiatBalance: fiatBalance.toString() }
}

export const withHederaNativeBalance = (balances: Balances, isHedera: boolean | undefined): Balances => {
  if (!isHedera) return balances

  const items = balances.items.map((item) =>
    item.tokenInfo.type === TokenType.NATIVE_TOKEN ? toTinybarNativeItem(item) : item,
  )
  // Shift the total by the native item's fiat correction only — CGW's own total may cover items
  // that aren't in `items` (e.g. filtered out), so it can't simply be re-summed from them
  const fiatCorrection = items.reduce(
    (sum, item, i) => sum + Number(item.fiatBalance || 0) - Number(balances.items[i].fiatBalance || 0),
    0,
  )

  return {
    ...balances,
    items,
    fiatTotal: (Number(balances.fiatTotal || 0) + fiatCorrection).toString(),
  }
}

// `isHedera` is passed in so this stays agnostic to how a caller determines that — normally
// `hasFeature(chain, FEATURES.HEDERA)` against the CGW-provided chain config, which callers
// already have on hand.
export const createPortfolioBalances = (balances: Balances, isHedera?: boolean): PortfolioBalances => {
  const corrected = withHederaNativeBalance(balances, isHedera)
  return {
    ...corrected,
    tokensFiatTotal: corrected.fiatTotal,
    positionsFiatTotal: '0',
    positions: undefined,
  }
}

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
