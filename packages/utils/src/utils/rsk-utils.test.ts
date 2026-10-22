import { getAddress } from 'ethers'
import {
  getRskAddress,
  getTxTargetAddress,
  isRskChecksummedAddress,
  normalizeRskChecksum,
  toEip1191ChecksumAddress,
  toRskCopyAddress,
  toRskDisplayAddress,
} from './rsk-utils'
import { FEATURES } from './chains'

// Test vectors from the ERC-1191 specification
const EIP55_ADDRESS = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed'
const RSK_MAINNET_ADDRESS = '0x5aaEB6053f3e94c9b9a09f33669435E7ef1bEAeD'
const RSK_TESTNET_ADDRESS = '0x5aAeb6053F3e94c9b9A09F33669435E7EF1BEaEd'

// Checksummed address copied from the Rootstock explorer
const EXPLORER_ADDRESS = '0x117Af1a3F236ccbd2Cb3851588e9ffBf66e82C60'

describe('rsk-utils', () => {
  describe('toEip1191ChecksumAddress', () => {
    it.each([
      [30, RSK_MAINNET_ADDRESS],
      [31, RSK_TESTNET_ADDRESS],
    ])('should match the ERC-1191 vector for chain id %s', (chainId, expected) => {
      expect(toEip1191ChecksumAddress(EIP55_ADDRESS.toLowerCase(), chainId)).toBe(expected)
    })
  })

  describe('isRskChecksummedAddress', () => {
    it.each([RSK_MAINNET_ADDRESS, RSK_TESTNET_ADDRESS, EXPLORER_ADDRESS])(
      'should accept the EIP-1191 checksum %s',
      (address) => {
        expect(isRskChecksummedAddress(address)).toBe(true)
      },
    )

    it('should reject an EIP-55 address that differs from the RSK forms', () => {
      expect(isRskChecksummedAddress(EIP55_ADDRESS)).toBe(false)
    })

    it('should reject a wrong checksum', () => {
      expect(isRskChecksummedAddress('0x5AAeb6053F3E94C9b9A09f33669435E7Ef1BeAed')).toBe(false)
    })

    it.each(['0x', '0x0', '0x1234', `${RSK_TESTNET_ADDRESS}a`])('should reject the non-address %s', (value) => {
      expect(isRskChecksummedAddress(value)).toBe(false)
    })
  })

  describe('normalizeRskChecksum', () => {
    it.each([RSK_MAINNET_ADDRESS, RSK_TESTNET_ADDRESS])('should convert %s to EIP-55', (address) => {
      expect(normalizeRskChecksum(address)).toBe(EIP55_ADDRESS)
    })

    it('should convert the explorer address to EIP-55', () => {
      expect(normalizeRskChecksum(EXPLORER_ADDRESS)).toBe(getAddress(EXPLORER_ADDRESS.toLowerCase()))
    })

    it('should keep the chain prefix', () => {
      expect(normalizeRskChecksum(`trbtc:${RSK_TESTNET_ADDRESS}`)).toBe(`trbtc:${EIP55_ADDRESS}`)
    })

    it.each([
      EIP55_ADDRESS,
      '0x5AAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
      '0x123',
      'name.rsk',
      `${RSK_TESTNET_ADDRESS}a`,
      `a${RSK_TESTNET_ADDRESS}`,
    ])('should return %s unchanged', (value) => {
      expect(normalizeRskChecksum(value)).toBe(value)
    })
  })

  describe('getRskAddress', () => {
    it.each([RSK_MAINNET_ADDRESS, RSK_TESTNET_ADDRESS, EIP55_ADDRESS, EIP55_ADDRESS.toLowerCase()])(
      'should return the EIP-55 form of %s',
      (address) => {
        expect(getRskAddress(address)).toBe(EIP55_ADDRESS)
      },
    )

    it('should throw for a checksum matching neither EIP-55 nor EIP-1191', () => {
      expect(() => getRskAddress('0x5AAeb6053F3E94C9b9A09f33669435E7Ef1BeAed')).toThrow()
    })

    it('should throw for an invalid address', () => {
      expect(() => getRskAddress('0x1234')).toThrow()
    })
  })

  describe('toRskDisplayAddress', () => {
    const rskMainnet = { chainId: '30', features: [FEATURES.ROOTSTOCK_SUPPORT] }
    const rskTestnet = { chainId: '31', features: [FEATURES.ROOTSTOCK_SUPPORT] }
    const txHash = '0xcfa9e0a83c6302603f1974b5aa4d48d406dfddabc176bb2f3763a8f3fece280f'

    it('should return the EIP-1191 form for the RSK chains', () => {
      expect(toRskDisplayAddress(EIP55_ADDRESS, rskMainnet)).toBe(RSK_MAINNET_ADDRESS)
      expect(toRskDisplayAddress(EIP55_ADDRESS, rskTestnet)).toBe(RSK_TESTNET_ADDRESS)
    })

    it('should return the address unchanged without Rootstock support', () => {
      expect(toRskDisplayAddress(EIP55_ADDRESS, { chainId: '30', features: [] })).toBe(EIP55_ADDRESS)
      expect(toRskDisplayAddress(EIP55_ADDRESS)).toBe(EIP55_ADDRESS)
    })

    it('should not touch values that are not 20-byte addresses', () => {
      expect(toRskDisplayAddress(txHash, rskMainnet)).toBe(txHash)
      expect(toRskDisplayAddress('0x1234', rskMainnet)).toBe('0x1234')
    })

    it('should round-trip through the input normalization', () => {
      expect(normalizeRskChecksum(toRskDisplayAddress(EIP55_ADDRESS, rskMainnet))).toBe(EIP55_ADDRESS)
    })
  })

  describe('toRskCopyAddress', () => {
    const rskMainnet = { chainId: '30', features: [FEATURES.ROOTSTOCK_SUPPORT] }
    const rskTestnet = { chainId: '31', features: [FEATURES.ROOTSTOCK_SUPPORT] }
    const txHash = '0xcfa9e0a83c6302603f1974b5aa4d48d406dfddabc176bb2f3763a8f3fece280f'

    it.each([rskMainnet, rskTestnet])('should return the lower-case address on chain %p', (chain) => {
      expect(toRskCopyAddress(EIP55_ADDRESS, chain)).toBe(EIP55_ADDRESS.toLowerCase())
      expect(toRskCopyAddress(RSK_MAINNET_ADDRESS, chain)).toBe(EIP55_ADDRESS.toLowerCase())
    })

    it('should return the address unchanged without Rootstock support', () => {
      expect(toRskCopyAddress(EIP55_ADDRESS, { features: [] })).toBe(EIP55_ADDRESS)
      expect(toRskCopyAddress(EIP55_ADDRESS)).toBe(EIP55_ADDRESS)
    })

    it('should not touch values that are not 20-byte addresses', () => {
      expect(toRskCopyAddress(txHash, rskMainnet)).toBe(txHash)
      expect(toRskCopyAddress('0x1234', rskMainnet)).toBe('0x1234')
    })
  })

  describe('getTxTargetAddress', () => {
    const rskChain = { features: [FEATURES.ROOTSTOCK_SUPPORT] }

    it('should accept the EIP-1191 address on chains with Rootstock support', () => {
      expect(getTxTargetAddress(RSK_TESTNET_ADDRESS, rskChain)).toBe(EIP55_ADDRESS)
    })

    it.each([{ features: [] }, undefined])('should reject the EIP-1191 address on chain %p', (chain) => {
      expect(() => getTxTargetAddress(RSK_TESTNET_ADDRESS, chain)).toThrow()
    })

    it('should return the EIP-55 form without a chain', () => {
      expect(getTxTargetAddress(EIP55_ADDRESS.toLowerCase())).toBe(EIP55_ADDRESS)
    })
  })
})
