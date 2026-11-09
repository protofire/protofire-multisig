import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  checkKey,
  recordCheckRequest,
  selectCheckRequestedAtMs,
  type CheckIdentity,
} from '@safe-global/store/safenet/safenetCheckSlice'
import { isWithinGrace } from '@safe-global/utils/features/safenet-checks/utils/computePollingInterval'
import { useAppDispatch, useAppSelector } from '@/store'
import { localItem } from '@/services/local-storage/local'
import { requestSafenetCheck } from '../services/requestSafenetCheck'

export type RequestCheckState = 'idle' | 'requesting' | 'failed'

const storedRequest = (identity: CheckIdentity) => localItem<number>(`safenetCheckRequested:${checkKey(identity)}`)

/**
 * Proposes a check and records the accepted request in the session slice, which
 * `useSafenetCheck` reports as `isRequested` for the grace window. The slice is
 * session-only, so the request is mirrored to local storage and restored from
 * there after a reload while it is still inside the window.
 */
export const useRequestSafenetCheck = ({ chainId, safeAddress, safeTxHash }: CheckIdentity) => {
  const identity = useMemo(() => ({ chainId, safeAddress, safeTxHash }), [chainId, safeAddress, safeTxHash])
  const dispatch = useAppDispatch()
  const [state, setState] = useState<RequestCheckState>('idle')
  const recordedAtMs = useAppSelector((rootState) => selectCheckRequestedAtMs(rootState, identity))

  useEffect(() => {
    if (recordedAtMs !== undefined) return
    const stored = storedRequest(identity)
    const storedAtMs = stored.get() ?? undefined
    if (storedAtMs === undefined) return
    if (isWithinGrace(storedAtMs, Date.now())) {
      dispatch(recordCheckRequest({ ...identity, requestedAtMs: storedAtMs }))
    } else {
      stored.remove()
    }
  }, [identity, recordedAtMs, dispatch])

  const request = useCallback(async () => {
    setState('requesting')
    try {
      await requestSafenetCheck(identity)
      const requestedAtMs = Date.now()
      storedRequest(identity).set(requestedAtMs)
      dispatch(recordCheckRequest({ ...identity, requestedAtMs }))
      setState('idle')
    } catch {
      setState('failed')
    }
  }, [identity, dispatch])

  return { request, state }
}
