import { renderHook, waitFor } from '@/tests/test-utils'
import * as hedera from '@/utils/hedera'
import useHederaAccountIdResolver from '../useHederaAccountIdResolver'

describe('useHederaAccountIdResolver', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('should resolve a native account id to its 0x address', async () => {
    jest.spyOn(hedera, 'getHederaEvmAddress').mockResolvedValue('0x000000000000000000000000000000000000004d')

    const { result } = renderHook(() => useHederaAccountIdResolver('0.0.77', hedera.HederaNetwork.TESTNET))

    await waitFor(() => {
      expect(result.current.address).toBe('0x000000000000000000000000000000000000004d')
    })
  })

  it('should not resolve when no network is given (non-Hedera chain)', () => {
    const spy = jest.spyOn(hedera, 'getHederaEvmAddress')

    const { result } = renderHook(() => useHederaAccountIdResolver('0.0.77', undefined))

    expect(result.current.address).toBeUndefined()
    expect(spy).not.toHaveBeenCalled()
  })

  it('should not resolve a value that is not a native account id', () => {
    const spy = jest.spyOn(hedera, 'getHederaEvmAddress')

    const { result } = renderHook(() =>
      useHederaAccountIdResolver('0xd89cfd973d251ff04d345a4962afb5efa6382036', hedera.HederaNetwork.TESTNET),
    )

    expect(result.current.address).toBeUndefined()
    expect(spy).not.toHaveBeenCalled()
  })

  it('should surface a resolution error', async () => {
    jest.spyOn(hedera, 'getHederaEvmAddress').mockRejectedValue(new Error('not found'))

    const { result } = renderHook(() => useHederaAccountIdResolver('0.0.999999', hedera.HederaNetwork.TESTNET))

    await waitFor(() => {
      expect(result.current.resolverError).toBeInstanceOf(Error)
    })
  })
})
