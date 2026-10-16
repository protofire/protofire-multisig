import { faker } from '@faker-js/faker'
import { getModuleInstance } from '@gnosis.pm/zodiac'

import { safeInfoBuilder } from '@/tests/builders/safe'
import { createSafeTx } from '@/tests/builders/safeTx'
import { connectedWalletBuilder } from '@/tests/builders/wallet'
import { renderHook, waitFor } from '@/tests/test-utils'
import { useIsRecoverer } from '../useIsRecoverer'
import { getPatchedSignerProvider } from '../../../../hooks/useIsValidExecution'
import {
  useIsValidRecoveryExecTransactionFromModule,
  useIsValidRecoveryExecuteNextTx,
  useIsValidRecoverySkipExpired,
} from '../useIsValidRecoveryExecution'
import { useRecoveryTxState } from '../useRecoveryTxState'
import useSafeInfo from '@/hooks/useSafeInfo'
import useWallet from '@/hooks/wallets/useWallet'
import { useWeb3ReadOnly } from '@/hooks/wallets/web3'

jest.mock('@gnosis.pm/zodiac')

const mockGetModuleInstance = getModuleInstance as jest.MockedFunction<typeof getModuleInstance>

jest.mock('@/hooks/wallets/useWallet')
jest.mock('@/hooks/useSafeInfo')
jest.mock('@/hooks/wallets/web3')
jest.mock('@/features/recovery/hooks/useIsRecoverer')
jest.mock('@/features/recovery/hooks/useRecoveryTxState')
jest.mock('@/hooks/useIsValidExecution')

const mockUseWallet = useWallet as jest.MockedFunction<typeof useWallet>
const mockUseSafeInfo = useSafeInfo as jest.MockedFunction<typeof useSafeInfo>
const mockUseWeb3ReadOnly = useWeb3ReadOnly as jest.MockedFunction<typeof useWeb3ReadOnly>
const mockUseIsRecoverer = useIsRecoverer as jest.MockedFunction<typeof useIsRecoverer>
const mockUseRecoveryTxState = useRecoveryTxState as jest.MockedFunction<typeof useRecoveryTxState>
const mockGetPatchedSignerOrProvider = getPatchedSignerProvider as jest.MockedFunction<typeof getPatchedSignerProvider>

describe('useIsValidRecoveryExecution', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('useIsValidRecoveryExecTransactionFromModule', () => {
    it('should return undefined if the user is not a recoverer', async () => {
      mockUseWallet.mockReturnValue(connectedWalletBuilder().build())
      mockUseSafeInfo.mockReturnValue({ safe: safeInfoBuilder().build() } as any)
      mockUseWeb3ReadOnly.mockReturnValue({} as any)
      mockUseIsRecoverer.mockReturnValue(false)

      const delayModifierAddress = faker.finance.ethereumAddress()
      const safeTx = createSafeTx()

      const { result } = renderHook(() => useIsValidRecoveryExecTransactionFromModule(delayModifierAddress, safeTx))

      expect(result.current).toEqual([undefined, undefined, true])

      await waitFor(() => {
        expect(result.current).toEqual([undefined, undefined, false])
      })
    })

    it('should return undefined if no delay modifier address is provided', async () => {
      mockUseWallet.mockReturnValue(connectedWalletBuilder().build())
      mockUseSafeInfo.mockReturnValue({ safe: safeInfoBuilder().build() } as any)
      mockUseWeb3ReadOnly.mockReturnValue({} as any)
      mockUseIsRecoverer.mockReturnValue(true)

      const safeTx = createSafeTx()
      const { result } = renderHook(() => useIsValidRecoveryExecTransactionFromModule(undefined, safeTx))

      expect(result.current).toEqual([undefined, undefined, true])

      await waitFor(() => {
        expect(result.current).toEqual([undefined, undefined, false])
      })
    })

    it('should return undefined if no transaction is provided', async () => {
      mockUseWallet.mockReturnValue(connectedWalletBuilder().build())
      mockUseSafeInfo.mockReturnValue({ safe: safeInfoBuilder().build() } as any)
      mockUseWeb3ReadOnly.mockReturnValue({} as any)
      mockUseIsRecoverer.mockReturnValue(true)

      const delayModifierAddress = faker.finance.ethereumAddress()
      const { result } = renderHook(() => useIsValidRecoveryExecTransactionFromModule(delayModifierAddress))

      expect(result.current).toEqual([undefined, undefined, true])

      await waitFor(() => {
        expect(result.current).toEqual([undefined, undefined, false])
      })
    })

    it('should return undefined if no wallet is connected', async () => {
      mockUseWallet.mockReturnValue(null)
      mockUseSafeInfo.mockReturnValue({ safe: safeInfoBuilder().build() } as any)
      mockUseWeb3ReadOnly.mockReturnValue({} as any)
      mockUseIsRecoverer.mockReturnValue(true)

      const delayModifierAddress = faker.finance.ethereumAddress()
      const safeTx = createSafeTx()

      const { result } = renderHook(() => useIsValidRecoveryExecTransactionFromModule(delayModifierAddress, safeTx))

      expect(result.current).toEqual([undefined, undefined, true])

      await waitFor(async () => {
        expect(result.current).toEqual([undefined, undefined, false])
      })
    })

    it('should return undefined if no provider is connected', async () => {
      mockUseWallet.mockReturnValue(connectedWalletBuilder().build())
      mockUseSafeInfo.mockReturnValue({ safe: safeInfoBuilder().build() } as any)
      mockUseWeb3ReadOnly.mockReturnValue(undefined)
      mockUseIsRecoverer.mockReturnValue(true)

      const ethereumAddress = faker.finance.ethereumAddress()
      const safeTx = createSafeTx()

      const { result } = renderHook(() => useIsValidRecoveryExecTransactionFromModule(ethereumAddress, safeTx))

      expect(result.current).toEqual([undefined, undefined, true])

      await waitFor(() => {
        expect(result.current).toEqual([undefined, undefined, false])
      })
    })

    it.each(['1', '728126428'])('should return whether the transaction is valid on chain %s', async (chainId) => {
      mockUseWallet.mockReturnValue(connectedWalletBuilder().build())
      mockUseSafeInfo.mockReturnValue({ safe: safeInfoBuilder().with({ chainId }).build() } as any)
      mockUseWeb3ReadOnly.mockReturnValue({} as any)
      mockUseIsRecoverer.mockReturnValue(true)

      mockGetPatchedSignerOrProvider.mockReturnValue({
        getSigner: () => ({}) as any,
      } as any)

      const isValid = false
      mockGetModuleInstance.mockReturnValue({
        connect: () => ({
          execTransactionFromModule: {
            staticCall: jest.fn().mockResolvedValue(isValid),
          },
        }),
      } as any)

      const delayModifierAddress = faker.finance.ethereumAddress()
      const safeTx = createSafeTx()

      const { result } = renderHook(() => useIsValidRecoveryExecTransactionFromModule(delayModifierAddress, safeTx))

      expect(result.current).toEqual([undefined, undefined, true])

      await waitFor(() => {
        expect(result.current[2]).toBe(false)
      })

      expect(result.current).toEqual([isValid, undefined, false])
      expect(mockGetModuleInstance).toHaveBeenCalledTimes(1)
    })

    it.each(['1', '728126428'])('returns validation errors on chain %s', async (chainId) => {
      mockUseWallet.mockReturnValue(connectedWalletBuilder().build())
      mockUseSafeInfo.mockReturnValue({ safe: safeInfoBuilder().with({ chainId }).build() } as any)
      mockUseWeb3ReadOnly.mockReturnValue({} as any)
      mockUseIsRecoverer.mockReturnValue(true)

      mockGetPatchedSignerOrProvider.mockReturnValue({
        getSigner: () => ({}) as any,
      } as any)

      const error = new Error('Some error')
      mockGetModuleInstance.mockReturnValue({
        connect: () => ({
          execTransactionFromModule: {
            staticCall: () => Promise.reject(error),
          },
        }),
      } as any)

      const delayModifierAddress = faker.finance.ethereumAddress()
      const safeTx = createSafeTx()

      const { result } = renderHook(() => useIsValidRecoveryExecTransactionFromModule(delayModifierAddress, safeTx))

      expect(result.current).toEqual([undefined, undefined, true])

      await waitFor(() => {
        expect(result.current).toEqual([undefined, error, false])
      })
    })
  })

  describe('useIsValidRecoveryExecuteNextTx', () => {
    it('should return undefined if the transaction is not executable', async () => {
      mockUseWallet.mockReturnValue(connectedWalletBuilder().build())
      mockUseSafeInfo.mockReturnValue({ safe: safeInfoBuilder().build() } as any)
      mockUseWeb3ReadOnly.mockReturnValue({} as any)
      mockUseRecoveryTxState.mockReturnValue({ isExecutable: false } as any)

      const recovery = {
        address: faker.finance.ethereumAddress(),
        args: {
          to: faker.finance.ethereumAddress(),
          value: BigInt(0),
          data: '0x',
          operation: 0,
        },
      }

      const { result } = renderHook(() => useIsValidRecoveryExecuteNextTx(recovery as any))

      expect(result.current).toEqual([undefined, undefined, true])

      await waitFor(() => {
        expect(result.current).toEqual([undefined, undefined, false])
      })
    })

    it('should return undefined if no wallet is connected', async () => {
      mockUseWallet.mockReturnValue(null)
      mockUseSafeInfo.mockReturnValue({ safe: safeInfoBuilder().build() } as any)
      mockUseWeb3ReadOnly.mockReturnValue({} as any)
      mockUseRecoveryTxState.mockReturnValue({ isExecutable: true } as any)

      const recovery = {
        address: faker.finance.ethereumAddress(),
        args: {
          to: faker.finance.ethereumAddress(),
          value: BigInt(0),
          data: '0x',
          operation: 0,
        },
      }

      const { result } = renderHook(() => useIsValidRecoveryExecuteNextTx(recovery as any))

      expect(result.current).toEqual([undefined, undefined, true])

      await waitFor(() => {
        expect(result.current).toEqual([undefined, undefined, false])
      })
    })

    it('should return undefined if no provider is connected', async () => {
      mockUseWallet.mockReturnValue(connectedWalletBuilder().build())
      mockUseSafeInfo.mockReturnValue({ safe: safeInfoBuilder().build() } as any)
      mockUseWeb3ReadOnly.mockReturnValue(undefined)
      mockUseRecoveryTxState.mockReturnValue({ isExecutable: true } as any)

      const recovery = {
        address: faker.finance.ethereumAddress(),
        args: {
          to: faker.finance.ethereumAddress(),
          value: BigInt(0),
          data: '0x',
          operation: 0,
        },
      }

      const { result } = renderHook(() => useIsValidRecoveryExecuteNextTx(recovery as any))

      expect(result.current).toEqual([undefined, undefined, true])

      await waitFor(() => {
        expect(result.current).toEqual([undefined, undefined, false])
      })
    })

    it.each(['1', '728126428'])('should return whether the transaction is valid on chain %s', async (chainId) => {
      mockUseWallet.mockReturnValue(connectedWalletBuilder().build())
      mockUseSafeInfo.mockReturnValue({ safe: safeInfoBuilder().with({ chainId }).build() } as any)
      mockUseWeb3ReadOnly.mockReturnValue({} as any)
      mockUseRecoveryTxState.mockReturnValue({ isExecutable: true } as any)

      mockGetPatchedSignerOrProvider.mockReturnValue({
        getSigner: () => ({}) as any,
      } as any)

      mockGetModuleInstance.mockReturnValue({
        connect: () => ({
          executeNextTx: {
            staticCall: () => Promise.resolve(),
          },
        }),
      } as any)

      const recovery = {
        address: faker.finance.ethereumAddress(),
        args: {
          to: faker.finance.ethereumAddress(),
          value: BigInt(0),
          data: '0x',
          operation: 0,
        },
      }

      const { result } = renderHook(() => useIsValidRecoveryExecuteNextTx(recovery as any))

      expect(result.current).toEqual([undefined, undefined, true])

      await waitFor(() => {
        expect(result.current).toEqual([true, undefined, false])
      })
      expect(mockGetModuleInstance).toHaveBeenCalledTimes(1)
    })

    it.each(['1', '728126428'])('returns preflight errors on chain %s', async (chainId) => {
      mockUseWallet.mockReturnValue(connectedWalletBuilder().build())
      mockUseSafeInfo.mockReturnValue({ safe: safeInfoBuilder().with({ chainId }).build() } as any)
      mockUseWeb3ReadOnly.mockReturnValue({} as any)
      mockUseRecoveryTxState.mockReturnValue({ isExecutable: true } as any)

      mockGetPatchedSignerOrProvider.mockReturnValue({
        getSigner: () => ({}) as any,
      } as any)

      const error = new Error('Some error')
      mockGetModuleInstance.mockReturnValue({
        connect: () => ({
          executeNextTx: {
            staticCall: () => Promise.reject(error),
          },
        }),
      } as any)

      const recovery = {
        address: faker.finance.ethereumAddress(),
        args: {
          to: faker.finance.ethereumAddress(),
          value: BigInt(0),
          data: '0x',
          operation: 0,
        },
      }

      const { result } = renderHook(() => useIsValidRecoveryExecuteNextTx(recovery as any))

      expect(result.current).toEqual([undefined, undefined, true])

      await waitFor(() => {
        expect(result.current).toEqual([undefined, error, false])
      })
    })
  })

  describe('useIsValidRecoverySkipExpired', () => {
    it('should return undefined if the transaction has not expired', async () => {
      mockUseWallet.mockReturnValue(connectedWalletBuilder().build())
      mockUseSafeInfo.mockReturnValue({ safe: safeInfoBuilder().build() } as any)
      mockUseWeb3ReadOnly.mockReturnValue({} as any)
      mockUseRecoveryTxState.mockReturnValue({ isExpired: false } as any)

      const recovery = {
        address: faker.finance.ethereumAddress(),
        args: {
          to: faker.finance.ethereumAddress(),
          value: BigInt(0),
          data: '0x',
          operation: 0,
        },
      }

      const { result } = renderHook(() => useIsValidRecoverySkipExpired(recovery as any))

      expect(result.current).toEqual([undefined, undefined, true])

      await waitFor(() => {
        expect(result.current).toEqual([undefined, undefined, false])
      })
    })

    it('should return undefined if no wallet is connected', async () => {
      mockUseWallet.mockReturnValue(null)
      mockUseSafeInfo.mockReturnValue({ safe: safeInfoBuilder().build() } as any)
      mockUseWeb3ReadOnly.mockReturnValue({} as any)
      mockUseRecoveryTxState.mockReturnValue({ isExpired: true } as any)

      const recovery = {
        address: faker.finance.ethereumAddress(),
        args: {
          to: faker.finance.ethereumAddress(),
          value: BigInt(0),
          data: '0x',
          operation: 0,
        },
      }

      const { result } = renderHook(() => useIsValidRecoverySkipExpired(recovery as any))

      expect(result.current).toEqual([undefined, undefined, true])

      await waitFor(() => {
        expect(result.current).toEqual([undefined, undefined, false])
      })
    })

    it('should return undefined if no provider is connected', async () => {
      mockUseWallet.mockReturnValue(connectedWalletBuilder().build())
      mockUseSafeInfo.mockReturnValue({ safe: safeInfoBuilder().build() } as any)
      mockUseWeb3ReadOnly.mockReturnValue(undefined)
      mockUseRecoveryTxState.mockReturnValue({ isExpired: true } as any)

      const recovery = {
        address: faker.finance.ethereumAddress(),
        args: {
          to: faker.finance.ethereumAddress(),
          value: BigInt(0),
          data: '0x',
          operation: 0,
        },
      }

      const { result } = renderHook(() => useIsValidRecoverySkipExpired(recovery as any))

      expect(result.current).toEqual([undefined, undefined, true])

      await waitFor(() => {
        expect(result.current).toEqual([undefined, undefined, false])
      })

      expect(result.current).toEqual([undefined, undefined, false])
    })

    it.each(['1', '728126428'])('should return true if the transaction is valid on chain %s', async (chainId) => {
      mockUseWallet.mockReturnValue(connectedWalletBuilder().build())
      mockUseSafeInfo.mockReturnValue({ safe: safeInfoBuilder().with({ chainId }).build() } as any)
      mockUseWeb3ReadOnly.mockReturnValue({} as any)
      mockUseRecoveryTxState.mockReturnValue({ isExpired: true } as any)

      mockGetPatchedSignerOrProvider.mockReturnValue({
        getSigner: () => ({}) as any,
      } as any)

      mockGetModuleInstance.mockReturnValue({
        connect: () => ({
          skipExpired: {
            staticCall: () => Promise.resolve(),
          },
        }),
      } as any)

      const recovery = {
        address: faker.finance.ethereumAddress(),
        args: {
          to: faker.finance.ethereumAddress(),
          value: BigInt(0),
          data: '0x',
          operation: 0,
        },
      }

      const { result } = renderHook(() => useIsValidRecoverySkipExpired(recovery as any))

      expect(result.current).toEqual([undefined, undefined, true])

      await waitFor(() => {
        expect(result.current).toEqual([true, undefined, false])
      })
      expect(mockGetModuleInstance).toHaveBeenCalledTimes(1)
    })

    it.each(['1', '728126428'])('returns preflight errors on chain %s', async (chainId) => {
      mockUseWallet.mockReturnValue(connectedWalletBuilder().build())
      mockUseSafeInfo.mockReturnValue({ safe: safeInfoBuilder().with({ chainId }).build() } as any)
      mockUseWeb3ReadOnly.mockReturnValue({} as any)
      mockUseRecoveryTxState.mockReturnValue({ isExpired: true } as any)

      mockGetPatchedSignerOrProvider.mockReturnValue({
        getSigner: () => ({}) as any,
      } as any)

      const error = new Error('Some error')
      mockGetModuleInstance.mockReturnValue({
        connect: () => ({
          skipExpired: {
            staticCall: () => Promise.reject(error),
          },
        }),
      } as any)

      const recovery = {
        address: faker.finance.ethereumAddress(),
        args: {
          to: faker.finance.ethereumAddress(),
          value: BigInt(0),
          data: '0x',
          operation: 0,
        },
      }

      const { result } = renderHook(() => useIsValidRecoverySkipExpired(recovery as any))

      expect(result.current).toEqual([undefined, undefined, true])

      await waitFor(() => {
        expect(result.current).toEqual([undefined, error, false])
      })
    })
  })
})
