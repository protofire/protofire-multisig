import { act, renderHook, waitFor } from '@/tests/test-utils'
import useGasPrice from '@/hooks/useGasPrice'
import { useCurrentChain } from '../useChains'
import { useWeb3ReadOnly } from '../wallets/web3'
import { getTotalFee, getTotalFeeFormatted } from '@safe-global/utils/hooks/useDefaultGasPrice'
import { FEATURES } from '@safe-global/utils/utils/chains'

const mockProviderSend = jest.fn()

// mock useWeb3Readonly
jest.mock('../wallets/web3', () => {
  const provider = {
    getFeeData: jest.fn(() =>
      Promise.resolve({
        gasPrice: undefined,
        maxFeePerGas: BigInt('0x956e'), //38254
        maxPriorityFeePerGas: BigInt('0x136f'), //4975
      }),
    ),
    send: (...args: unknown[]) => mockProviderSend(...args),
  }
  return {
    useWeb3ReadOnly: jest.fn(() => provider),
  }
})
const currentChain = {
  chainId: '4',
  gasPrice: [
    {
      type: 'oracle',
      uri: 'https://api.etherscan.io/v2/api?chainid=4&module=gastracker&action=gasoracle',
      gasParameter: 'FastGasPrice',
      gweiFactor: '1000000000.000000000',
    },
    {
      type: 'oracle',
      uri: 'https://ethgasstation.info/json/ethgasAPI.json',
      gasParameter: 'fast',
      gweiFactor: '200000000.000000000',
    },
    {
      type: 'fixed',
      weiValue: '24000000000',
    },
  ],
  features: ['EIP1559'],
}
// Mock useCurrentChain
jest.mock('@/hooks/useChains', () => {
  return {
    __esModule: true,
    default: jest.fn(() => ({ configs: [] })),
    useCurrentChain: jest.fn(() => currentChain),
  }
})

const mockUseChainId = jest.fn(() => currentChain.chainId)
jest.mock('@/hooks/useChainId', () => ({
  __esModule: true,
  default: () => mockUseChainId(),
}))

describe('useGasPrice', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    ;(useCurrentChain as jest.Mock).mockReturnValue(currentChain)
  })

  it('should return the fetched gas price from the first oracle', async () => {
    // Mock fetch
    Object.defineProperty(window, 'fetch', {
      writable: true,
      value: jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: {
                FastGasPrice: '47',
                suggestBaseFee: '44',
              },
            }),
        }),
      ),
    })

    // render the hook
    const { result } = renderHook(() => useGasPrice())

    // assert the hook is loading
    expect(result.current[2]).toBe(true)

    // wait for the hook to fetch the gas price
    await act(async () => {
      await Promise.resolve()
    })

    expect(fetch).toHaveBeenCalledWith('https://api.etherscan.io/v2/api?chainid=4&module=gastracker&action=gasoracle')

    // assert the hook is not loading
    expect(result.current[2]).toBe(false)

    // assert the gas price is correct
    expect(result.current[0]?.maxFeePerGas?.toString()).toBe('47000000000')

    // assert the priority fee is correct
    expect(result.current[0]?.maxPriorityFeePerGas?.toString()).toEqual('3000000000')
  })

  it('should speed up the gas price', async () => {
    // Mock fetch
    Object.defineProperty(window, 'fetch', {
      writable: true,
      value: jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: {
                FastGasPrice: '30',
                suggestBaseFee: '10',
              },
            }),
        }),
      ),
    })

    // render the hook
    const { result } = renderHook(() => useGasPrice(true))

    // assert the hook is loading
    expect(result.current[2]).toBe(true)

    // wait for the hook to fetch the gas price
    await act(async () => {
      await Promise.resolve()
    })

    expect(fetch).toHaveBeenCalledWith('https://api.etherscan.io/v2/api?chainid=4&module=gastracker&action=gasoracle')

    // assert the hook is not loading
    expect(result.current[2]).toBe(false)

    // assert the gas price is correct
    expect(result.current[0]?.maxFeePerGas?.toString()).toBe('50000000000')

    // assert the priority fee is correct
    expect(result.current[0]?.maxPriorityFeePerGas?.toString()).toEqual('40000000000')
  })

  it('should return the fetched gas price from the second oracle if the first one fails', async () => {
    // Mock fetch
    jest.spyOn(window, 'fetch').mockImplementation(
      jest
        .fn()
        .mockImplementationOnce(() => Promise.reject(new Error('Failed to fetch')))
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                result: {
                  fast: 300,
                },
              }),
          }),
        ),
    )

    // render the hook
    const { result } = renderHook(() => useGasPrice())

    // assert the hook is loading
    expect(result.current[2]).toBe(true)

    await waitFor(() => {
      // assert the hook is not loading
      expect(result.current[2]).toBe(false)

      expect(fetch).toHaveBeenCalledWith('https://api.etherscan.io/v2/api?chainid=4&module=gastracker&action=gasoracle')
      expect(fetch).toHaveBeenCalledWith('https://ethgasstation.info/json/ethgasAPI.json')
    })

    // assert the gas price is correct
    expect(result.current[0]?.maxFeePerGas?.toString()).toBe('60000000000')

    // assert the priority fee is correct
    expect(result.current[0]?.maxPriorityFeePerGas?.toString()).toEqual('4975')
  })

  it('should fallback to a fixed gas price if the oracles fail', async () => {
    // Mock fetch
    jest.spyOn(window, 'fetch').mockImplementation(
      jest
        .fn()
        .mockImplementationOnce(() => Promise.reject(new Error('Failed to fetch')))
        .mockImplementationOnce(() => Promise.reject(new Error('Failed to fetch'))),
    )

    // render the hook
    const { result } = renderHook(() => useGasPrice())

    // assert the hook is loading
    expect(result.current[2]).toBe(true)

    // wait for the hook to fetch the gas price
    await act(async () => {
      await Promise.resolve()
    })

    expect(fetch).toHaveBeenCalledWith('https://api.etherscan.io/v2/api?chainid=4&module=gastracker&action=gasoracle')
    expect(fetch).toHaveBeenCalledWith('https://ethgasstation.info/json/ethgasAPI.json')

    // assert the hook is not loading
    expect(result.current[2]).toBe(false)

    // assert the gas price is correct
    expect(result.current[0]?.maxFeePerGas?.toString()).toBe('24000000000')

    // assert the priority fee is correct
    expect(result.current[0]?.maxPriorityFeePerGas?.toString()).toEqual('4975')
  })

  it('should be able to set a fixed EIP 1559 gas price', async () => {
    ;(useCurrentChain as jest.Mock).mockReturnValue({
      chainId: '10',
      gasPrice: [
        {
          type: 'fixed1559',
          maxFeePerGas: '100000000',
          maxPriorityFeePerGas: '100000',
        },
      ],
      features: ['EIP1559'],
    })

    const { result } = renderHook(() => useGasPrice())

    await act(async () => {
      await Promise.resolve()
    })
    // assert the hook is not loading
    expect(result.current[2]).toBe(false)

    // assert fixed gas price as minimum of 0.1 gwei
    expect(result.current[0]?.maxFeePerGas?.toString()).toBe('100000000')

    // assert fixed priority fee
    expect(result.current[0]?.maxPriorityFeePerGas?.toString()).toBe('100000')
  })

  it("should use the previous block's fee data if there are no oracles", async () => {
    ;(useCurrentChain as jest.Mock).mockReturnValue({
      chainId: '1',
      gasPrice: [],
      features: ['EIP1559'],
    })

    const { result } = renderHook(() => useGasPrice())

    await act(async () => {
      await Promise.resolve()
    })
    // assert the hook is not loading
    expect(result.current[2]).toBe(false)

    // assert gas price from provider
    expect(result.current[0]?.maxFeePerGas?.toString()).toBe('38254')

    // assert priority fee from provider
    expect(result.current[0]?.maxPriorityFeePerGas?.toString()).toBe('4975')
  })

  it('should keep the previous gas price if the hook re-renders', async () => {
    // Mock fetch
    Object.defineProperty(window, 'fetch', {
      writable: true,
      value: jest
        .fn()
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                data: {
                  FastGasPrice: '21',
                  suggestBaseFee: '19',
                },
              }),
          }),
        )
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                data: {
                  FastGasPrice: '22',
                  suggestBaseFee: '19',
                },
              }),
          }),
        ),
    })

    // render the hook
    const { result } = renderHook(() => useGasPrice())

    // assert the hook is loading
    expect(result.current[2]).toBe(true)

    expect(result.current[0]?.maxFeePerGas).toBe(undefined)

    // wait for the hook to fetch the gas price
    await act(async () => {
      await Promise.resolve()
    })

    // assert the hook is not loading
    expect(result.current[2]).toBe(false)

    expect(result.current[0]?.maxFeePerGas?.toString()).toBe('21000000000')

    // render the hook again
    const { result: result2 } = renderHook(() => useGasPrice())

    // assert the hook is not loading (as a value exists)
    expect(result.current[2]).toBe(false)

    expect(result.current[0]?.maxFeePerGas?.toString()).toBe('21000000000')

    // wait for the hook to fetch the gas price
    await act(async () => {
      await Promise.resolve()
    })

    // assert the hook is not loading
    expect(result.current[2]).toBe(false)

    expect(result2.current[0]?.maxFeePerGas?.toString()).toBe('22000000000')
  })
})

describe('useGasPrice on Tron', () => {
  const TRON_CHAIN_ID = '728126428'

  beforeEach(() => {
    jest.clearAllMocks()
    mockUseChainId.mockReturnValue(TRON_CHAIN_ID)
    ;(useCurrentChain as jest.Mock).mockReturnValue({ ...currentChain, chainId: TRON_CHAIN_ID })
  })

  it('returns the energy price from eth_gasPrice', async () => {
    mockProviderSend.mockResolvedValueOnce('0x1a4') // 420

    const { result } = renderHook(() => useGasPrice())

    await waitFor(() => {
      expect(result.current[2]).toBe(false)
    })

    expect(result.current[0]?.maxFeePerGas).toBe(420n)
    expect(result.current[0]?.maxPriorityFeePerGas).toBe(0n)
    expect(result.current[1]).toBeUndefined()
  })

  it('falls back to the fixed energy price if eth_gasPrice fails', async () => {
    mockProviderSend.mockRejectedValueOnce(new Error('Temporary internal error'))

    const { result } = renderHook(() => useGasPrice())

    await waitFor(() => {
      expect(result.current[2]).toBe(false)
    })

    expect(result.current[0]?.maxFeePerGas).toBe(100n)
    expect(result.current[0]?.maxPriorityFeePerGas).toBe(0n)
    expect(result.current[1]).toBeUndefined()
  })
})

describe('useGasPrice on Hedera', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    mockUseChainId.mockReturnValue('295')
    ;(useCurrentChain as jest.Mock).mockReturnValue({
      chainId: '295',
      gasPrice: [],
      features: [],
    })
  })

  it('must return the real, unscaled (18-decimal weibar) gas price — it is submitted with the transaction as-is', async () => {
    // Hedera has no EIP1559 feature flag, so useDefaultGasPrice sources maxFeePerGas from the
    // legacy `feeData.gasPrice` field (see getGasParameters) — Hashio quotes it in the standard
    // 18-decimal weibar convention. This exact value is what execTransaction is broadcast with
    // (via useAdvancedParams -> executeTx), so it must never be rescaled here: a wallet like
    // MetaMask that submits a real eth_sendRawTransaction (unlike HashPack, which never uses
    // maxFeePerGas at all) would otherwise be broadcast a ~10^10-times-too-low, underpriced
    // transaction and get rejected by the relay.
    ;(useWeb3ReadOnly as jest.Mock).mockReturnValue({
      getFeeData: jest.fn(() =>
        Promise.resolve({
          gasPrice: BigInt('0x956e'), // 38254
          maxFeePerGas: undefined,
          maxPriorityFeePerGas: undefined,
        }),
      ),
    })

    const { result } = renderHook(() => useGasPrice())

    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current[2]).toBe(false)
    expect(result.current[0]?.maxFeePerGas?.toString()).toBe('38254')
  })
})

describe('getTotalFee', () => {
  it('returns the totalFee', () => {
    const result = getTotalFee(1n, 100n)
    expect(result).toEqual(100n)
  })

  it('handles large numbers', () => {
    const result = getTotalFee(10000000000000000n, 123123123n)

    expect(result).toEqual(1231231230000000000000000n)
  })
})

describe('getTotalFeeFormatted on Hedera', () => {
  it('formats the fee total at 18 decimals (real weibar scale), not HBAR’s own 8 display decimals', () => {
    // 834866 gasLimit x 1110 Gwei (in weibar/18-decimal terms) is ~0.93 HBAR — formatting at
    // HBAR's 8 display decimals instead would read this as ~9.27B HBAR.
    const maxFeePerGas = 1110n * 1_000_000_000n // 1110 Gwei in wei
    const gasLimit = 834866n
    const hederaChain = { chainId: '295', nativeCurrency: { decimals: 8 }, features: [FEATURES.HEDERA] } as Parameters<
      typeof getTotalFeeFormatted
    >[2]

    const totalFee = getTotalFeeFormatted(maxFeePerGas, gasLimit, hederaChain)

    expect(Number(totalFee)).toBeCloseTo(0.9267, 3)
  })
})
