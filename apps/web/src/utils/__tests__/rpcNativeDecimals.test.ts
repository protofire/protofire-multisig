import { chainBuilder } from '@/tests/builders/chains'
import { FEATURES } from '@safe-global/utils/utils/chains'
import { getRpcNativeCurrencyDecimals, HEDERA_RPC_NATIVE_DECIMALS } from '../rpcNativeDecimals'

describe('getRpcNativeCurrencyDecimals', () => {
  it('should use the 18-decimal weibar convention on Hedera, ignoring nativeCurrency.decimals', () => {
    const hedera = chainBuilder()
      .with({ features: [FEATURES.HEDERA], nativeCurrency: { name: 'HBAR', symbol: 'HBAR', decimals: 8, logoUri: '' } })
      .build()

    expect(getRpcNativeCurrencyDecimals(hedera)).toBe(HEDERA_RPC_NATIVE_DECIMALS)
  })

  it("should use the chain's own native currency decimals elsewhere", () => {
    const evmChain = chainBuilder()
      .with({ features: [], nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18, logoUri: '' } })
      .build()
    const sixDecimals = chainBuilder()
      .with({ features: [], nativeCurrency: { name: 'Six', symbol: 'SIX', decimals: 6, logoUri: '' } })
      .build()

    expect(getRpcNativeCurrencyDecimals(evmChain)).toBe(18)
    expect(getRpcNativeCurrencyDecimals(sixDecimals)).toBe(6)
  })

  it('should return undefined while the chain is not loaded', () => {
    expect(getRpcNativeCurrencyDecimals(undefined)).toBeUndefined()
  })
})
