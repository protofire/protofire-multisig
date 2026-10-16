import { utils as tronWebUtils } from 'tronweb'
import { isTronAddressHex, toTronBase58Sync, formatAddressForExplorer } from '@/utils/tron'

const HEX_ADDRESS = '0x0b9ca12d2ce6a6ec17df8fc602144c55a6ab1717'
const BASE58_ADDRESS = 'TB2c4z3BMsxhY6EsmkqcktUuonyVYXWFhC'
const TX_HASH = '0xcfa9e0a83c6302603f1974b5aa4d48d406dfddabc176bb2f3763a8f3fece280f'
const TRON_CHAIN_ID = '728126428'
const ETH_CHAIN_ID = '1'

describe('isTronAddressHex', () => {
  it('returns true for a 20-byte 0x address', () => {
    expect(isTronAddressHex(HEX_ADDRESS)).toBe(true)
  })

  it('returns false for a 32-byte 0x hash', () => {
    expect(isTronAddressHex(TX_HASH)).toBe(false)
  })
})

describe('toTronBase58Sync', () => {
  beforeEach(() => {
    jest.spyOn(tronWebUtils.address, 'fromHex').mockReturnValue(BASE58_ADDRESS)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('converts a 20-byte address to base58', () => {
    expect(toTronBase58Sync(HEX_ADDRESS)).toBe(BASE58_ADDRESS)
    expect(tronWebUtils.address.fromHex).toHaveBeenCalledWith('41' + HEX_ADDRESS.slice(2))
  })

  it('returns a 32-byte hash unchanged instead of converting it', () => {
    expect(toTronBase58Sync(TX_HASH)).toBe(TX_HASH)
    expect(tronWebUtils.address.fromHex).not.toHaveBeenCalled()
  })
})

describe('formatAddressForExplorer', () => {
  beforeEach(() => {
    jest.spyOn(tronWebUtils.address, 'fromHex').mockReturnValue(BASE58_ADDRESS)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('converts a hex address to base58 on a Tron chain', () => {
    expect(formatAddressForExplorer(HEX_ADDRESS, TRON_CHAIN_ID)).toBe(BASE58_ADDRESS)
  })

  it('leaves the address unchanged on a non-Tron chain', () => {
    expect(formatAddressForExplorer(HEX_ADDRESS, ETH_CHAIN_ID)).toBe(HEX_ADDRESS)
    expect(tronWebUtils.address.fromHex).not.toHaveBeenCalled()
  })

  it('leaves a 32-byte tx hash unchanged on a Tron chain', () => {
    expect(formatAddressForExplorer(TX_HASH, TRON_CHAIN_ID)).toBe(TX_HASH)
    expect(tronWebUtils.address.fromHex).not.toHaveBeenCalled()
  })
})
