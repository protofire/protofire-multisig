import { renderHook } from '@/tests/test-utils'
import { useNativeTokenInfo } from '../useNativeTokenInfo'
import * as useChains from '../useChains'
import { chainBuilder } from '@/tests/builders/chains'
import { FEATURES } from '@safe-global/utils/utils/chains'

const hbarCurrency = { name: 'HBAR', symbol: 'HBAR', decimals: 8, logoUri: 'https://example.com/hbar.png' }
const ethCurrency = { name: 'Ether', symbol: 'ETH', decimals: 18, logoUri: 'https://example.com/eth.png' }

describe('useNativeTokenInfo', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('should use the chain-configured decimals on a Hedera chain', () => {
    // Regression: this hook only ever decodes the Safe's own (outgoing) transaction data, which
    // is always submitted using HBAR's real 8-decimal tinybar precision — never Hashio's
    // 18-decimal weibar RPC wire-format. Forcing 18 here made a decoded 0.0001 HBAR transfer
    // display as 0.00000000000001.
    jest.spyOn(useChains, 'useCurrentChain').mockReturnValue(
      chainBuilder()
        .with({ chainId: '295', features: [FEATURES.HEDERA], nativeCurrency: hbarCurrency })
        .build(),
    )

    const { result } = renderHook(() => useNativeTokenInfo())

    expect(result.current.decimals).toBe(8)
  })

  it('should use the chain-configured decimals on a non-Hedera chain', () => {
    jest
      .spyOn(useChains, 'useCurrentChain')
      .mockReturnValue(chainBuilder().with({ chainId: '1', features: [], nativeCurrency: ethCurrency }).build())

    const { result } = renderHook(() => useNativeTokenInfo())

    expect(result.current.decimals).toBe(18)
  })
})
