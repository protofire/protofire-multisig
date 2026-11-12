import type { Delay } from '@gnosis.pm/zodiac'

import { render } from '@/tests/test-utils'
import { logError, Errors } from '@/services/exceptions'
import { isRecoveryUnavailable } from '@/features/recovery/hooks/useRecovery'
import type { RecoveryState } from '@/features/recovery/services/recovery-state'
import RecoveryContextHooks from '../RecoveryContextHooks'
import { useRecoveryDelayModifiers } from '../useRecoveryDelayModifiers'
import { useRecoveryState } from '../useRecoveryState'
import store from '..'

jest.mock('@/services/exceptions', () => ({
  ...jest.requireActual('@/services/exceptions'),
  logError: jest.fn(),
}))
jest.mock('../useRecoveryDelayModifiers')
jest.mock('../useRecoveryState')
jest.mock('../useRecoveryPendingTxs', () => ({ useRecoveryPendingTxs: () => ({}) }))
jest.mock('../useRecoverySuccessEvents', () => ({ useRecoverySuccessEvents: jest.fn() }))

const mockUseRecoveryDelayModifiers = useRecoveryDelayModifiers as jest.MockedFunction<typeof useRecoveryDelayModifiers>
const mockUseRecoveryState = useRecoveryState as jest.MockedFunction<typeof useRecoveryState>

describe('RecoveryContextHooks', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    store.setStore({ state: [undefined, undefined, false], pending: {} })
  })

  it('should only log a failure to find the Delay Modifiers, as the Safe may have none', () => {
    const error = new Error('could not detect network')
    mockUseRecoveryDelayModifiers.mockReturnValue([undefined, error, false])
    mockUseRecoveryState.mockReturnValue([undefined, undefined, false])

    render(<RecoveryContextHooks />)

    expect(isRecoveryUnavailable(store.getStore()?.state)).toBe(false)
    expect(store.getStore()?.delayModifiersError).toBe(error)
    expect(logError).toHaveBeenCalledWith(Errors._617, error)
  })

  it('should make recovery unavailable when the state of found Delay Modifiers fails to load', () => {
    const error = new Error('Recovery transaction 0 not found')
    mockUseRecoveryDelayModifiers.mockReturnValue([[{} as Delay], undefined, false])
    mockUseRecoveryState.mockReturnValue([undefined, error, false])

    render(<RecoveryContextHooks />)

    expect(store.getStore()?.state).toEqual([undefined, error, false])
    expect(isRecoveryUnavailable(store.getStore()?.state)).toBe(true)
    expect(logError).toHaveBeenCalledWith(Errors._617, error)
  })

  it('should provide the loaded recovery state', () => {
    const recoveryState = [{ queue: [], unavailableQueue: [] }] as unknown as RecoveryState
    mockUseRecoveryDelayModifiers.mockReturnValue([[{} as Delay], undefined, false])
    mockUseRecoveryState.mockReturnValue([recoveryState, undefined, false])

    render(<RecoveryContextHooks />)

    expect(store.getStore()?.state).toEqual([recoveryState, undefined, false])
    expect(store.getStore()?.delayModifiersError).toBeUndefined()
    expect(logError).not.toHaveBeenCalled()
  })
})
