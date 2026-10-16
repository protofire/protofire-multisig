import { mockWeb3Provider, renderHook, waitFor } from '@/tests/test-utils'
import useGasLimit from '../useGasLimit'
import * as safeCoreSDK from '../coreSDK/safeCoreSDK'
import * as useWallet from '../wallets/useWallet'
import * as useSafeInfo from '../useSafeInfo'
import * as useIsSafeOwner from '../useIsSafeOwner'
import * as useChains from '@/hooks/useChains'
import * as useLoadFeatureModule from '@/features/__core__/useLoadFeature'
import * as walletUtils from '@/utils/wallets'

import { mockContractManager } from '@/tests/mocks/contractManager'
import type Safe from '@safe-global/protocol-kit'
import { faker } from '@faker-js/faker'
import { connectedWalletBuilder } from '@/tests/builders/wallet'
import { createMockSafeTransaction } from '@/tests/transactions'
import { safeInfoBuilder } from '@/tests/builders/safe'
import { type JsonRpcProvider, zeroPadValue } from 'ethers'
import { Gnosis_safe__factory } from '@safe-global/utils/types/contracts/factories/@safe-global/safe-deployments/dist/assets/v1.3.0'
import { generatePreValidatedSignature } from '@safe-global/protocol-kit/dist/src/utils'

const contractManager = mockContractManager()

const walletAddress = faker.finance.ethereumAddress()
const prevSignerAddress = faker.finance.ethereumAddress()

const safeInfo = safeInfoBuilder().with({ threshold: 1 }).build()
let mockWeb3: JsonRpcProvider
describe('useGasLimit', () => {
  beforeEach(() => {
    jest.resetAllMocks()

    jest.spyOn(safeCoreSDK, 'useSafeSDK').mockReturnValue({
      getContractManager: () => contractManager,
    } as unknown as Safe)

    jest
      .spyOn(useWallet, 'useSigner')
      .mockReturnValue(connectedWalletBuilder().with({ address: walletAddress }).build())
    jest.spyOn(useSafeInfo, 'default').mockReturnValue({
      safe: { ...safeInfo, deployed: true },
      safeAddress: safeInfo.address.value,
      safeLoaded: true,
      safeLoading: false,
      safeError: undefined,
    })
    jest.spyOn(useIsSafeOwner, 'default').mockReturnValue(true)
    jest.spyOn(useChains, 'useHasFeature').mockReturnValue(false)
    mockWeb3 = mockWeb3Provider([])
  })
  it('should return undefined for undefined safeTx', async () => {
    const { result } = renderHook(() => useGasLimit())
    await waitFor(async () => {
      expect(result.current).toEqual({ gasLimit: undefined, gasLimitLoading: false, gasLimitError: undefined })
    })
  })

  it('should return undefined if no owner is connected', async () => {
    jest.spyOn(useWallet, 'useSigner').mockReturnValue(
      connectedWalletBuilder()
        .with({
          address: undefined,
        })
        .build(),
    )

    const safeTx = createMockSafeTransaction({
      data: '0x00',
      to: faker.finance.ethereumAddress(),
    })

    const { result } = renderHook(() => useGasLimit(safeTx))
    await waitFor(async () => {
      expect(result.current).toEqual({ gasLimit: undefined, gasLimitLoading: false, gasLimitError: undefined })
    })
  })

  it('should return estimated gas', async () => {
    const safeTx = createMockSafeTransaction({
      data: '0x00',
      to: faker.finance.ethereumAddress(),
    })

    const { result } = renderHook(() => useGasLimit(safeTx))
    await waitFor(async () => {
      expect(result.current).toEqual({ gasLimit: 50_000n, gasLimitLoading: false, gasLimitError: undefined })
    })
  })

  it('should not modify the signature if fully signed', async () => {
    const safeTx = createMockSafeTransaction({
      data: '0x00',
      to: faker.finance.ethereumAddress(),
    })

    safeTx.addSignature({
      signer: prevSignerAddress,
      data: zeroPadValue('0x1234', 32),
      isContractSignature: false,
      dynamicPart: () => '',
      staticPart: () => zeroPadValue('0x1234', 32),
    })

    const expectedCallData = Gnosis_safe__factory.createInterface().encodeFunctionData('execTransaction', [
      safeTx.data.to,
      safeTx.data.value,
      safeTx.data.data,
      safeTx.data.operation,
      safeTx.data.safeTxGas,
      safeTx.data.baseGas,
      safeTx.data.gasPrice,
      safeTx.data.gasToken,
      safeTx.data.refundReceiver,
      safeTx.encodedSignatures(),
    ])

    const { result } = renderHook(() => useGasLimit(safeTx))
    await waitFor(async () => {
      expect(result.current).toEqual({ gasLimit: 50_000n, gasLimitLoading: false, gasLimitError: undefined })
    })
    expect(mockWeb3.estimateGas).toHaveBeenCalledWith({
      to: safeInfo.address.value,
      from: walletAddress,
      data: expectedCallData,
    })
  })

  it('should add a prevalidated signature if a signature is missing', async () => {
    const safeTx = createMockSafeTransaction({
      data: '0x00',
      to: faker.finance.ethereumAddress(),
    })
    const prevalidatedSignature = generatePreValidatedSignature(walletAddress)
    const expectedCallData = Gnosis_safe__factory.createInterface().encodeFunctionData('execTransaction', [
      safeTx.data.to,
      safeTx.data.value,
      safeTx.data.data,
      safeTx.data.operation,
      safeTx.data.safeTxGas,
      safeTx.data.baseGas,
      safeTx.data.gasPrice,
      safeTx.data.gasToken,
      safeTx.data.refundReceiver,
      prevalidatedSignature.staticPart(),
    ])

    const { result } = renderHook(() => useGasLimit(safeTx))
    await waitFor(async () => {
      expect(result.current).toEqual({ gasLimit: 50_000n, gasLimitLoading: false, gasLimitError: undefined })
    })
    expect(mockWeb3.estimateGas).toHaveBeenCalledWith({
      to: safeInfo.address.value,
      from: walletAddress,
      data: expectedCallData,
    })
  })
})

describe('useGasLimit – Oasis signed eth_call', () => {
  const sapphireChainId = '23294'
  const sapphireSafeInfo = safeInfoBuilder().with({ threshold: 1, chainId: sapphireChainId }).build()
  const validateOasisSignedCall = jest.fn()
  const readyFeature = { $isReady: true, validateOasisSignedCall } as unknown as ReturnType<
    typeof useLoadFeatureModule.useLoadFeature
  >
  const loadingFeature = { $isReady: false } as unknown as ReturnType<typeof useLoadFeatureModule.useLoadFeature>

  beforeEach(() => {
    jest.resetAllMocks()

    jest.spyOn(safeCoreSDK, 'useSafeSDK').mockReturnValue({
      getContractManager: () => mockContractManager(),
    } as unknown as Safe)

    jest
      .spyOn(useWallet, 'useSigner')
      .mockReturnValue(connectedWalletBuilder().with({ address: walletAddress, chainId: sapphireChainId }).build())

    jest.spyOn(useSafeInfo, 'default').mockReturnValue({
      safe: { ...sapphireSafeInfo, deployed: true },
      safeAddress: sapphireSafeInfo.address.value,
      safeLoaded: true,
      safeLoading: false,
      safeError: undefined,
    })

    jest.spyOn(useIsSafeOwner, 'default').mockReturnValue(true)
    jest.spyOn(useChains, 'useHasFeature').mockReturnValue(true)
    jest.spyOn(useLoadFeatureModule, 'useLoadFeature').mockReturnValue(readyFeature)
    validateOasisSignedCall.mockResolvedValue(undefined)
    jest.spyOn(walletUtils, 'isSmartContractWallet').mockResolvedValue(false)

    mockWeb3Provider([])
  })

  it('returns the gas limit and validates with a signed eth_call', async () => {
    const safeTx = createMockSafeTransaction({ data: '0x', to: faker.finance.ethereumAddress() })

    const { result } = renderHook(() => useGasLimit(safeTx))
    await waitFor(() => {
      expect(result.current.gasLimitLoading).toBe(false)
    })

    expect(result.current.gasLimit).toBe(50_000n)
    expect(result.current.gasLimitError).toBeUndefined()
    expect(validateOasisSignedCall).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ from: walletAddress, gasLimit: 50_000n }),
      Number(sapphireChainId),
    )
  })

  it('surfaces gasLimitError when the signed call detects a revert', async () => {
    const revertError = Object.assign(new Error('GS013: Method can only be called from this contract'), {
      response: { module: 'evm', code: 8 },
    })
    validateOasisSignedCall.mockRejectedValue(revertError)

    const safeTx = createMockSafeTransaction({ data: '0x', to: faker.finance.ethereumAddress() })

    const { result } = renderHook(() => useGasLimit(safeTx))
    await waitFor(() => {
      expect(result.current.gasLimitLoading).toBe(false)
    })

    expect(result.current.gasLimit).toBeUndefined()
    expect(result.current.gasLimitError).toBe(revertError)
  })

  it('surfaces gasLimitError when the user dismisses the signing prompt', async () => {
    const rejection = Object.assign(new Error('user rejected action'), { code: 'ACTION_REJECTED' })
    validateOasisSignedCall.mockRejectedValue(rejection)

    const safeTx = createMockSafeTransaction({ data: '0x', to: faker.finance.ethereumAddress() })

    const { result } = renderHook(() => useGasLimit(safeTx))
    await waitFor(() => {
      expect(result.current.gasLimitLoading).toBe(false)
    })

    expect(result.current.gasLimit).toBeUndefined()
    expect(result.current.gasLimitError).toBe(rejection)
  })

  it('validates once when the feature handle is re-created on every render', async () => {
    jest.spyOn(useLoadFeatureModule, 'useLoadFeature').mockImplementation(() => ({ ...readyFeature }))
    const safeTx = createMockSafeTransaction({ data: '0x', to: faker.finance.ethereumAddress() })

    const { result, rerender } = renderHook(() => useGasLimit(safeTx))
    await waitFor(() => {
      expect(result.current.gasLimitLoading).toBe(false)
    })
    expect(validateOasisSignedCall).toHaveBeenCalledTimes(1)

    rerender()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(validateOasisSignedCall).toHaveBeenCalledTimes(1)
  })

  it('does not validate when the signer is a nested Safe', async () => {
    jest
      .spyOn(useWallet, 'useSigner')
      .mockReturnValue({ address: walletAddress, chainId: sapphireChainId, provider: null, isSafe: true })
    const safeTx = createMockSafeTransaction({ data: '0x', to: faker.finance.ethereumAddress() })

    const { result } = renderHook(() => useGasLimit(safeTx))
    await waitFor(() => {
      expect(result.current.gasLimitLoading).toBe(false)
    })

    expect(result.current.gasLimit).toBe(50_000n)
    expect(validateOasisSignedCall).not.toHaveBeenCalled()
  })

  it('does not validate when the connected wallet is a smart contract', async () => {
    jest.spyOn(walletUtils, 'isSmartContractWallet').mockResolvedValue(true)
    const safeTx = createMockSafeTransaction({ data: '0x', to: faker.finance.ethereumAddress() })

    const { result } = renderHook(() => useGasLimit(safeTx))
    await waitFor(() => {
      expect(result.current.gasLimitLoading).toBe(false)
    })

    expect(result.current.gasLimit).toBe(50_000n)
    expect(validateOasisSignedCall).not.toHaveBeenCalled()
  })

  it('does not validate when the flag is disabled for the chain', async () => {
    jest.spyOn(useChains, 'useHasFeature').mockReturnValue(false)
    const safeTx = createMockSafeTransaction({ data: '0x', to: faker.finance.ethereumAddress() })

    const { result } = renderHook(() => useGasLimit(safeTx))
    await waitFor(() => {
      expect(result.current.gasLimitLoading).toBe(false)
    })

    expect(result.current.gasLimit).toBe(50_000n)
    expect(validateOasisSignedCall).not.toHaveBeenCalled()
  })

  it('does not return a gas limit until the feature service has loaded', async () => {
    jest.spyOn(useLoadFeatureModule, 'useLoadFeature').mockReturnValue(loadingFeature)
    const safeTx = createMockSafeTransaction({ data: '0x', to: faker.finance.ethereumAddress() })

    const { result } = renderHook(() => useGasLimit(safeTx))
    await waitFor(() => {
      expect(result.current.gasLimitLoading).toBe(false)
    })

    expect(result.current.gasLimit).toBeUndefined()
    expect(validateOasisSignedCall).not.toHaveBeenCalled()
  })
})
