import { useEffect } from 'react'
import { useRecoveryState } from './useRecoveryState'
import { useRecoveryDelayModifiers } from './useRecoveryDelayModifiers'
import { useRecoveryPendingTxs } from './useRecoveryPendingTxs'
import { useRecoverySuccessEvents } from './useRecoverySuccessEvents'
import { logError, Errors } from '@/services/exceptions'
import store from '.'

function RecoveryContextHooks(): null {
  const [delayModifiers, delayModifiersError, delayModifiersLoading] = useRecoveryDelayModifiers()
  const [recoveryState, recoveryStateError, recoveryStateLoading] = useRecoveryState(delayModifiers)
  const pending = useRecoveryPendingTxs()

  useRecoverySuccessEvents(pending, recoveryState)

  const data = recoveryState
  // Most Safes with modules have no Delay Modifier, so failing to find them must not report missing proposals
  const error = recoveryStateError
  const loading = delayModifiersLoading || recoveryStateLoading

  useEffect(() => {
    const loadError = delayModifiersError || recoveryStateError
    if (loadError) {
      logError(Errors._617, loadError)
    }
  }, [delayModifiersError, recoveryStateError])

  useEffect(() => {
    store.setStore({
      state: [data, error, loading],
      pending,
      delayModifiersError,
    })
  }, [data, error, loading, pending, delayModifiersError])

  return null
}

export default RecoveryContextHooks
