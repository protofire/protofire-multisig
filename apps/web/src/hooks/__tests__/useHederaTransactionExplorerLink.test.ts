import { renderHook } from '@/tests/test-utils'
import * as useChains from '../useChains'
import { chainBuilder } from '@/tests/builders/chains'
import { FEATURES } from '@safe-global/utils/utils/chains'
import useHederaTransactionExplorerLink from '../useHederaTransactionExplorerLink'

const HEDERA_TRANSACTION_ID = '0.0.10822511-1787674970-069053976'

describe('useHederaTransactionExplorerLink', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('should return undefined without a Hedera transaction id', () => {
    jest.spyOn(useChains, 'useCurrentChain').mockReturnValue(
      chainBuilder()
        .with({ chainId: '295', features: [FEATURES.HEDERA] })
        .build(),
    )

    expect(renderHook(() => useHederaTransactionExplorerLink(undefined)).result.current).toBeUndefined()
  })

  it('should return undefined on a non-Hedera chain', () => {
    jest
      .spyOn(useChains, 'useCurrentChain')
      .mockReturnValue(chainBuilder().with({ chainId: '1', features: [] }).build())

    const { result } = renderHook(() => useHederaTransactionExplorerLink(HEDERA_TRANSACTION_ID))

    expect(result.current).toBeUndefined()
  })

  it('should link to the HashScan mainnet transaction page', () => {
    jest.spyOn(useChains, 'useCurrentChain').mockReturnValue(
      chainBuilder()
        .with({ chainId: '295', features: [FEATURES.HEDERA], isTestnet: false })
        .build(),
    )

    const { result } = renderHook(() => useHederaTransactionExplorerLink(HEDERA_TRANSACTION_ID))

    expect(result.current).toEqual({
      href: `https://hashscan.io/mainnet/transaction/${HEDERA_TRANSACTION_ID}`,
      title: 'View on hashscan.io',
    })
  })

  it('should link to the HashScan testnet transaction page', () => {
    jest.spyOn(useChains, 'useCurrentChain').mockReturnValue(
      chainBuilder()
        .with({ chainId: '296', features: [FEATURES.HEDERA], isTestnet: true })
        .build(),
    )

    const { result } = renderHook(() => useHederaTransactionExplorerLink(HEDERA_TRANSACTION_ID))

    expect(result.current?.href).toBe(`https://hashscan.io/testnet/transaction/${HEDERA_TRANSACTION_ID}`)
  })
})
