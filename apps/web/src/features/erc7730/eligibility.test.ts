import { faker } from '@faker-js/faker'
import { renderHook } from '@/tests/test-utils'
import { Interface } from 'ethers'
import type { TransactionData } from '@safe-global/store/gateway/AUTO_GENERATED/transactions'
import { Operation } from '@safe-global/store/gateway/types'
import { Multi_send__factory } from '@safe-global/utils/types/contracts/factories/@safe-global/safe-deployments/dist/assets/v1.3.0'
import * as useChains from '@/hooks/useChains'
import { useClearSigningLookupEnabled, useIsClearSigningEligible } from './eligibility'

const mockUseHasFeature = () => jest.spyOn(useChains, 'useHasFeature')

const erc20Interface = new Interface(['function transfer(address to, uint256 value)'])

const transferCalldata = () => erc20Interface.encodeFunctionData('transfer', [faker.finance.ethereumAddress(), 1n])

const createTxData = (overrides: Partial<TransactionData> = {}): TransactionData => ({
  to: { value: faker.finance.ethereumAddress() },
  operation: Operation.CALL,
  hexData: transferCalldata(),
  ...overrides,
})

describe('useClearSigningLookupEnabled', () => {
  it('mirrors the chain feature flag and treats an unknown chain as disabled', () => {
    mockUseHasFeature().mockReturnValue(true)
    expect(renderHook(() => useClearSigningLookupEnabled()).result.current).toBe(true)

    mockUseHasFeature().mockReturnValue(undefined)
    expect(renderHook(() => useClearSigningLookupEnabled()).result.current).toBe(false)
  })
})

describe('useIsClearSigningEligible', () => {
  beforeEach(() => {
    mockUseHasFeature().mockReturnValue(true)
  })

  it('returns true for an enabled CALL with calldata', () => {
    const { result } = renderHook(() => useIsClearSigningEligible(createTxData()))
    expect(result.current).toBe(true)
  })

  it('returns false for a DELEGATE call', () => {
    const { result } = renderHook(() => useIsClearSigningEligible(createTxData({ operation: Operation.DELEGATE })))
    expect(result.current).toBe(false)
  })

  it('returns true for a call to a Safe, which resolves through its singleton', () => {
    const safeInterface = new Interface(['function changeThreshold(uint256 _threshold)'])
    const hexData = safeInterface.encodeFunctionData('changeThreshold', [2n])
    const { result } = renderHook(() => useIsClearSigningEligible(createTxData({ hexData })))
    expect(result.current).toBe(true)
  })

  it.each([null, '', '0x'])('returns false for empty calldata (%p)', (hexData) => {
    const { result } = renderHook(() => useIsClearSigningEligible(createTxData({ hexData })))
    expect(result.current).toBe(false)
  })

  it('returns false for missing txData', () => {
    const { result } = renderHook(() => useIsClearSigningEligible(undefined))
    expect(result.current).toBe(false)
  })

  it('returns false for multisend calldata', () => {
    const hexData = Multi_send__factory.createInterface().encodeFunctionData('multiSend', ['0x'])
    const { result } = renderHook(() => useIsClearSigningEligible(createTxData({ hexData })))
    expect(result.current).toBe(false)
  })
})
