import { getAddress, isAddress, keccak256, toUtf8Bytes } from 'ethers'
import type { Chain } from '@safe-global/store/gateway/AUTO_GENERATED/chains'
import { FEATURES, hasFeature } from './chains'

// Chain ids hashed into the EIP-1191 checksum. Rootstock behaviour itself is gated by the ROOTSTOCK_SUPPORT flag
const RSK_CHAIN_IDS = ['30', '31'] as const

export const isRootstockSupportEnabled = (chain: Pick<Chain, 'features'>): boolean =>
  hasFeature(chain, FEATURES.ROOTSTOCK_SUPPORT)

/**
 * EIP-1191 checksum of a 40-hex address for the given chain id
 */
export const toEip1191ChecksumAddress = (address: string, chainId: string | number): string => {
  const cleaned = address.toLowerCase().replace(/^0x/, '')
  const hash = keccak256(toUtf8Bytes(`${chainId}0x${cleaned}`)).replace(/^0x/, '')

  return `0x${[...cleaned].map((char, i) => (parseInt(hash[i], 16) >= 8 ? char.toUpperCase() : char)).join('')}`
}

/**
 * Whether the address is in the EIP-1191 checksum form of any RSK chain. Explorers and RSK wallets
 * output either form regardless of the network the user is on
 */
export const isRskChecksummedAddress = (address: string): boolean =>
  isAddress(address.toLowerCase()) &&
  RSK_CHAIN_IDS.some((chainId) => toEip1191ChecksumAddress(address, chainId) === address)

/**
 * Replaces an EIP-1191 (RSK) checksummed address inside the value with its EIP-55 form, keeping any chain prefix.
 * Other values are returned unchanged, so EIP-55 typo protection still applies to them
 */
export const normalizeRskChecksum = (value: string): string =>
  value.replace(/\b0x[0-9a-f]{40}\b/i, (address) =>
    isRskChecksummedAddress(address) ? getAddress(address.toLowerCase()) : address,
  )

/**
 * Returns the EIP-55 form of the address, accepting EIP-1191 (RSK) checksummed input.
 * Throws like ethers' `getAddress` for invalid input or a checksum matching neither form
 */
export const getRskAddress = (address: string): string => getAddress(normalizeRskChecksum(address))

/**
 * EIP-55 form of a transaction target. Chains with Rootstock support also accept EIP-1191 input
 */
export const getTxTargetAddress = (address: string, chain?: Pick<Chain, 'features'>): string =>
  chain && isRootstockSupportEnabled(chain) ? getRskAddress(address) : getAddress(address)

const EVM_ADDRESS_REGEX = /^0x[0-9a-fA-F]{40}$/

/**
 * EIP-1191 form of an address for display only. Values that are not 20-byte addresses (e.g. tx hashes) and
 * chains without Rootstock support are returned unchanged
 */
export const toRskDisplayAddress = (address: string, chain?: Pick<Chain, 'chainId' | 'features'>): string =>
  chain && isRootstockSupportEnabled(chain) && EVM_ADDRESS_REGEX.test(address)
    ? toEip1191ChecksumAddress(address, chain.chainId)
    : address

/**
 * Lower-case form of an address for copying. Wallets such as MetaMask reject EIP-1191 checksums, while
 * lower-case addresses are accepted everywhere. Same scope as `toRskDisplayAddress`
 */
export const toRskCopyAddress = (address: string, chain?: Pick<Chain, 'features'>): string =>
  chain && isRootstockSupportEnabled(chain) && EVM_ADDRESS_REGEX.test(address) ? address.toLowerCase() : address
