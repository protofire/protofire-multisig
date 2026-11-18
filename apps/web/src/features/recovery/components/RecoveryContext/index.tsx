import ExternalStore from '@safe-global/utils/services/ExternalStore'
import type { PendingRecoveryTransactions } from './useRecoveryPendingTxs'
import type { AsyncResult } from '@safe-global/utils/hooks/useAsync'
import type { RecoveryState } from '@/features/recovery/services/recovery-state'

export type RecoveryContextType = {
  state: AsyncResult<RecoveryState>
  pending: PendingRecoveryTransactions
  /** Set when finding the Delay Modifiers failed, so it is unknown whether the Safe has recovery */
  delayModifiersError?: Error
}

// Empty until RecoveryContextHooks writes it, so readers can tell "not loaded yet" from "no recovery"
const recoveryStore = new ExternalStore<RecoveryContextType>()

export default recoveryStore
