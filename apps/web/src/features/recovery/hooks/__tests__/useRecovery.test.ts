import { isRecoveryUnavailable } from '../useRecovery'
import type { RecoveryState, UnavailableRecoveryQueueItem } from '@/features/recovery/services/recovery-state'

const recoveryState = (unavailableQueue: Array<UnavailableRecoveryQueueItem> = []) =>
  [{ queue: [], unavailableQueue }] as unknown as RecoveryState

describe('isRecoveryUnavailable', () => {
  it('should be false when the recovery state loaded without unavailable proposals', () => {
    expect(isRecoveryUnavailable([recoveryState(), undefined, false])).toBe(false)
  })

  it('should be true when the recovery state failed to load', () => {
    expect(isRecoveryUnavailable([undefined, new Error('Recovery transaction 0 not found'), false])).toBe(true)
  })

  it('should be true while the recovery state loads for the first time', () => {
    expect(isRecoveryUnavailable([undefined, undefined, true])).toBe(true)
  })

  it('should be true when a queued proposal is too old for the RPC to load its details', () => {
    const unavailableProposal = { timestamp: BigInt(1) } as UnavailableRecoveryQueueItem

    expect(isRecoveryUnavailable([recoveryState([unavailableProposal]), undefined, false])).toBe(true)
  })
})
