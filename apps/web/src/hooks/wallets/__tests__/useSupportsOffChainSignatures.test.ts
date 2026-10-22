import { renderHook } from '@/tests/test-utils'
import * as useWallet from '@/hooks/wallets/useWallet'
import type { ConnectedWallet } from '@/hooks/wallets/useOnboard'
import useSupportsOffChainSignatures from '../useSupportsOffChainSignatures'

const mockWallet = (label: string) =>
  jest.spyOn(useWallet, 'default').mockReturnValue({ label, address: '0x1', chainId: '295' } as ConnectedWallet)

describe('useSupportsOffChainSignatures', () => {
  afterEach(() => jest.restoreAllMocks())

  it('should be false for HashPack, which only signs native Hedera transactions', () => {
    mockWallet('HashPack')
    expect(renderHook(() => useSupportsOffChainSignatures()).result.current).toBe(false)
  })

  it('should be true for an EVM wallet such as MetaMask', () => {
    mockWallet('MetaMask')
    expect(renderHook(() => useSupportsOffChainSignatures()).result.current).toBe(true)
  })

  it('should be true while no wallet is connected', () => {
    jest.spyOn(useWallet, 'default').mockReturnValue(null)
    expect(renderHook(() => useSupportsOffChainSignatures()).result.current).toBe(true)
  })
})
