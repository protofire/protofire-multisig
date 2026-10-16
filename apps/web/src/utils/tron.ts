import { utils as tronWebUtils } from 'tronweb'
import { isTronChain } from './tron-chains'

export { isTronChain }

/**
 * Check if a 0x hex value is a 20-byte address (0x + 40 hex chars), as opposed to
 * a 32-byte hash (0x + 64 hex chars) or any other length, which must not be
 * converted to a Tron base58 address.
 */
export const isTronAddressHex = (hexValue: string): boolean => {
  return /^0x[0-9a-fA-F]{40}$/.test(hexValue)
}

/**
 * Synchronous 0x → base58 conversion using the bundled TronWeb util.
 * Independent of window.tronWeb / TronLink injection timing, so first paint
 * after a page refresh shows the correct base58 (T...) format.
 * Returns the input unchanged for anything that isn't a 20-byte address (e.g. a 32-byte
 * tx/safeTxHash), or on conversion failure.
 */
export const toTronBase58Sync = (hexAddr: string): string => {
  if (!isTronAddressHex(hexAddr)) return hexAddr

  try {
    // TronWeb expects hex with 41 prefix
    const raw = '41' + hexAddr.replace(/^0x/, '')
    return tronWebUtils.address.fromHex(raw)
  } catch {
    return hexAddr
  }
}

/**
 * Synchronous base58 → 0x conversion using the bundled TronWeb util.
 * Independent of window.tronWeb. Falls back to the input on failure.
 */
export const fromTronBase58Sync = (base58Addr: string): string => {
  try {
    const hex = tronWebUtils.address.toHex(base58Addr)
    // TronWeb returns hex with 41 prefix, convert to 0x
    return '0x' + hex.slice(2)
  } catch {
    return base58Addr
  }
}

/**
 * Check if a string looks like a Tron base58 address (starts with T, 34 chars).
 */
export const isTronBase58Address = (value: string): boolean => {
  return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(value)
}

/**
 * Format a Tron base58 address for short display: TXyz...89ab
 */
export const formatTronShortAddress = (base58Addr: string, chars = 4): string => {
  if (!base58Addr || base58Addr.length < chars * 2 + 1) return base58Addr
  return `${base58Addr.slice(0, chars + 1)}...${base58Addr.slice(-chars)}`
}

/**
 * Convert an address to base58 for building a Tronscan explorer link, for callers
 * (e.g. mapping over a list of addresses) that can't use the useTronAddress hook.
 * getBlockExplorerLink strips a leading 0x for Tron chains on the assumption the
 * address is already base58, so this must run before it's called.
 */
export const formatAddressForExplorer = (address: string, chainId: string): string => {
  return isTronChain(chainId) ? toTronBase58Sync(address) : address
}
