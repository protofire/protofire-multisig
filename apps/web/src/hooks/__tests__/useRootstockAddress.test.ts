import { renderHook } from '@/tests/test-utils'
import useRootstockAddress, { useRootstockCopyAddressFormatter } from '@/hooks/useRootstockAddress'
import * as useChainIdHook from '@/hooks/useChainId'
import * as useChainsHook from '@/hooks/useChains'
import { FEATURES } from '@safe-global/utils/utils/chains'
import { toEip1191ChecksumAddress } from '@safe-global/utils/utils/rsk-utils'
import type { Chain } from '@safe-global/store/gateway/AUTO_GENERATED/chains'

const RSK_CHAIN_ID = '30'
const ETH_CHAIN_ID = '1'

const EVM_ADDRESS = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed'
const TX_HASH = '0xcfa9e0a83c6302603f1974b5aa4d48d406dfddabc176bb2f3763a8f3fece280f'

const rskChain = { chainId: RSK_CHAIN_ID, features: [FEATURES.ROOTSTOCK_SUPPORT] } as unknown as Chain

describe('useRootstockAddress', () => {
  beforeEach(() => {
    jest.restoreAllMocks()
    jest.spyOn(useChainIdHook, 'default').mockReturnValue(RSK_CHAIN_ID)
    jest.spyOn(useChainsHook, 'useChain').mockReturnValue(rskChain)
  })

  it('returns the EIP-1191 address on Rootstock by default', () => {
    const { result } = renderHook(() => useRootstockAddress(EVM_ADDRESS))

    expect(result.current).toBe(toEip1191ChecksumAddress(EVM_ADDRESS, RSK_CHAIN_ID))
    expect(result.current).not.toBe(EVM_ADDRESS)
  })

  it('returns the plain address when the checksum setting is off', () => {
    const { result } = renderHook(() => useRootstockAddress(EVM_ADDRESS), {
      initialReduxState: { settings: { rootstockAddressChecksum: false } } as never,
    })

    expect(result.current).toBe(EVM_ADDRESS)
  })

  it('returns the plain address without Rootstock support', () => {
    jest.spyOn(useChainIdHook, 'default').mockReturnValue(ETH_CHAIN_ID)
    jest.spyOn(useChainsHook, 'useChain').mockReturnValue({ chainId: ETH_CHAIN_ID, features: [] } as unknown as Chain)

    const { result } = renderHook(() => useRootstockAddress(EVM_ADDRESS))

    expect(result.current).toBe(EVM_ADDRESS)
  })

  it('leaves a 32-byte hash untouched', () => {
    const { result } = renderHook(() => useRootstockAddress(TX_HASH))

    expect(result.current).toBe(TX_HASH)
  })

  describe('useRootstockCopyAddressFormatter', () => {
    it('returns the lower-case address on Rootstock', () => {
      const { result } = renderHook(() => useRootstockCopyAddressFormatter()(EVM_ADDRESS))

      expect(result.current).toBe(EVM_ADDRESS.toLowerCase())
    })

    it('ignores the checksum setting', () => {
      const { result } = renderHook(() => useRootstockCopyAddressFormatter()(EVM_ADDRESS), {
        initialReduxState: { settings: { rootstockAddressChecksum: false } } as never,
      })

      expect(result.current).toBe(EVM_ADDRESS.toLowerCase())
    })

    it('returns the address unchanged without Rootstock support', () => {
      jest.spyOn(useChainIdHook, 'default').mockReturnValue(ETH_CHAIN_ID)
      jest.spyOn(useChainsHook, 'useChain').mockReturnValue({ chainId: ETH_CHAIN_ID, features: [] } as unknown as Chain)

      const { result } = renderHook(() => useRootstockCopyAddressFormatter()(EVM_ADDRESS))

      expect(result.current).toBe(EVM_ADDRESS)
    })

    it('leaves a 32-byte hash untouched', () => {
      const { result } = renderHook(() => useRootstockCopyAddressFormatter()(TX_HASH))

      expect(result.current).toBe(TX_HASH)
    })
  })
})
