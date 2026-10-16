import { renderHook } from '@/tests/test-utils'
import useTronAddress from '@/hooks/useTronAddress'
import * as useChainIdHook from '@/hooks/useChainId'
import * as store from '@/store'
import * as tronUtils from '@/utils/tron'

const TRON_MAINNET_CHAIN_ID = '728126428'
const ETH_CHAIN_ID = '1'

const HEX_ADDRESS = '0x0b9ca12d2ce6a6ec17df8fc602144c55a6ab1717'
const BASE58_ADDRESS = 'TB2c4z3BMsxhY6EsmkqcktUuonyVYXWFhC'
const TX_HASH = '0xcfa9e0a83c6302603f1974b5aa4d48d406dfddabc176bb2f3763a8f3fece280f'

describe('useTronAddress', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(useChainIdHook, 'default').mockReturnValue(TRON_MAINNET_CHAIN_ID)
    jest
      .spyOn(store, 'useAppSelector')
      .mockImplementation((selector) => selector({ settings: { tronAddressFormat: 'base58' } } as any))
    jest.spyOn(tronUtils, 'toTronBase58Sync').mockReturnValue(BASE58_ADDRESS)
  })

  it('converts a 20-byte address to base58 on a Tron chain', () => {
    const { result } = renderHook(() => useTronAddress(HEX_ADDRESS))

    expect(result.current.isTron).toBe(true)
    expect(result.current.displayAddress).toBe(BASE58_ADDRESS)
    expect(result.current.copyAddress).toBe(BASE58_ADDRESS)
    expect(tronUtils.toTronBase58Sync).toHaveBeenCalledWith(HEX_ADDRESS)
  })

  it('leaves a 32-byte tx hash untouched on a Tron chain', () => {
    const { result } = renderHook(() => useTronAddress(TX_HASH))

    expect(result.current.isTron).toBe(true)
    expect(result.current.displayAddress).toBe(TX_HASH)
    expect(result.current.copyAddress).toBe(TX_HASH)
    expect(result.current.shortAddress).toBe(TX_HASH)
    expect(tronUtils.toTronBase58Sync).not.toHaveBeenCalled()
  })

  it('leaves values untouched on a non-Tron chain', () => {
    jest.spyOn(useChainIdHook, 'default').mockReturnValue(ETH_CHAIN_ID)

    const { result } = renderHook(() => useTronAddress(HEX_ADDRESS))

    expect(result.current.isTron).toBe(false)
    expect(result.current.displayAddress).toBe(HEX_ADDRESS)
    expect(tronUtils.toTronBase58Sync).not.toHaveBeenCalled()
  })

  it('leaves the address as hex when the hex format is selected', () => {
    jest
      .spyOn(store, 'useAppSelector')
      .mockImplementation((selector) => selector({ settings: { tronAddressFormat: 'hex' } } as any))

    const { result } = renderHook(() => useTronAddress(HEX_ADDRESS))

    expect(result.current.isTron).toBe(true)
    expect(result.current.displayAddress).toBe(HEX_ADDRESS)
    expect(tronUtils.toTronBase58Sync).not.toHaveBeenCalled()
  })
})
