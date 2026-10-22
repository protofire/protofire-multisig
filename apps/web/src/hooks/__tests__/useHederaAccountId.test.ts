import { renderHook, waitFor } from '@/tests/test-utils'
import * as hedera from '@/utils/hedera'
import * as useChains from '../useChains'
import { chainBuilder } from '@/tests/builders/chains'
import { FEATURES } from '@safe-global/utils/utils/chains'
import useHederaAccountId from '../useHederaAccountId'

describe('useHederaAccountId', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('should return isHedera: false and no accountId on a non-Hedera chain', () => {
    const spy = jest.spyOn(hedera, 'getHederaAccountId')
    jest.spyOn(useChains, 'useChain').mockReturnValue(chainBuilder().with({ chainId: '1', features: [] }).build())

    const { result } = renderHook(() => useHederaAccountId('0x1234567890000000000000000000000000000000', '1'))

    expect(result.current.isHedera).toBe(false)
    expect(result.current.accountId).toBeUndefined()
    expect(spy).not.toHaveBeenCalled()
  })

  it('should resolve the native account id on a Hedera chain', async () => {
    jest.spyOn(hedera, 'getHederaAccountId').mockResolvedValue('0.0.10814740')
    jest.spyOn(useChains, 'useChain').mockReturnValue(
      chainBuilder()
        .with({ chainId: '295', features: [FEATURES.HEDERA], isTestnet: false })
        .build(),
    )

    const { result } = renderHook(() => useHederaAccountId('0xd89cfd973d251ff04d345a4962afb5efa6382036', '295'))

    expect(result.current.isHedera).toBe(true)

    await waitFor(() => {
      expect(result.current.accountId).toBe('0.0.10814740')
    })
  })

  it('should work for Hedera testnet too', async () => {
    const spy = jest.spyOn(hedera, 'getHederaAccountId').mockResolvedValue('0.0.999')
    jest.spyOn(useChains, 'useChain').mockReturnValue(
      chainBuilder()
        .with({ chainId: '296', features: [FEATURES.HEDERA], isTestnet: true })
        .build(),
    )

    const { result } = renderHook(() => useHederaAccountId('0xabc', '296'))

    await waitFor(() => {
      expect(result.current.accountId).toBe('0.0.999')
    })
    expect(spy).toHaveBeenCalledWith('testnet', '0xabc')
  })
})
