import { act, renderHook, waitFor } from '@/tests/test-utils'
import { checkKey, selectCheckRequestedAtMs } from '@safe-global/store/safenet/safenetCheckSlice'
import { UNAVAILABLE_GRACE_MS } from '@safe-global/utils/features/safenet-checks/constants'
import { getStoreInstance } from '@/store'
import { requestSafenetCheck } from '../../services/requestSafenetCheck'
import { useRequestSafenetCheck } from '../useRequestSafenetCheck'

jest.mock('../../services/requestSafenetCheck', () => ({ requestSafenetCheck: jest.fn() }))

const identity = {
  chainId: '42161',
  safeAddress: '0x61af6845aA50eaC727422Bc458d9041C7b336E0A',
  safeTxHash: '0x' + '2'.repeat(64),
}
const storageKey = `SAFE_v2__safenetCheckRequested:${checkKey(identity)}`
const seedStorage = (requestedAtMs: number) => window.localStorage.setItem(storageKey, JSON.stringify(requestedAtMs))
const recordedAtMs = () => selectCheckRequestedAtMs(getStoreInstance().getState(), identity)

describe('useRequestSafenetCheck', () => {
  beforeEach(() => {
    jest.mocked(requestSafenetCheck).mockReset()
    window.localStorage.clear()
  })

  it('starts idle with nothing recorded', () => {
    const { result } = renderHook(() => useRequestSafenetCheck(identity))
    expect(result.current.state).toBe('idle')
    expect(recordedAtMs()).toBeUndefined()
  })

  it('records an accepted request in the store and in local storage', async () => {
    jest.mocked(requestSafenetCheck).mockResolvedValue(undefined)
    const { result } = renderHook(() => useRequestSafenetCheck(identity))

    await act(() => result.current.request())

    expect(requestSafenetCheck).toHaveBeenCalledWith(identity)
    expect(result.current.state).toBe('idle')
    expect(recordedAtMs()).toBeDefined()
    expect(window.localStorage.getItem(storageKey)).not.toBeNull()
  })

  it('reports a failed request and records nothing', async () => {
    jest.mocked(requestSafenetCheck).mockRejectedValue(new Error('503'))
    const { result } = renderHook(() => useRequestSafenetCheck(identity))

    await act(() => result.current.request())

    expect(result.current.state).toBe('failed')
    expect(recordedAtMs()).toBeUndefined()
    expect(window.localStorage.getItem(storageKey)).toBeNull()
  })

  it('restores a request still inside the grace window from local storage after a reload', async () => {
    const storedAtMs = Date.now() - 1_000
    seedStorage(storedAtMs)
    renderHook(() => useRequestSafenetCheck(identity))

    await waitFor(() => expect(recordedAtMs()).toBe(storedAtMs))
  })

  it('drops a stored request that is older than the grace window', () => {
    seedStorage(Date.now() - UNAVAILABLE_GRACE_MS - 1)
    renderHook(() => useRequestSafenetCheck(identity))

    expect(recordedAtMs()).toBeUndefined()
    expect(window.localStorage.getItem(storageKey)).toBeNull()
  })
})
