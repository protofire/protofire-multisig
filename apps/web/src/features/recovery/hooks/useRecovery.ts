import store, { type RecoveryContextType } from '../components/RecoveryContext'
import { selectUnavailableRecoveryQueues } from '../services/selectors'

function useRecovery(): RecoveryContextType['state'] {
  return store.useStore()?.state || [undefined, undefined, false]
}

const EMPTY_RECOVERY_STATE: RecoveryContextType['state'] = [undefined, undefined, false]

/**
 * True when a missing queue must not be treated as "no proposals": the load failed, the first
 * load has not finished, or some queued proposals are too old for the RPC to load their details.
 * A failed load keeps any proposals already shown.
 */
export const isRecoveryUnavailable = (state: RecoveryContextType['state'] = EMPTY_RECOVERY_STATE): boolean => {
  const [recovery, error, loading] = state
  const hasUnavailableProposals = !!recovery && (selectUnavailableRecoveryQueues(recovery)?.length ?? 0) > 0
  return error !== undefined || (Boolean(loading) && recovery === undefined) || hasUnavailableProposals
}

export function useRecoveryUnavailable(): boolean {
  return isRecoveryUnavailable(useRecovery())
}

export default useRecovery
