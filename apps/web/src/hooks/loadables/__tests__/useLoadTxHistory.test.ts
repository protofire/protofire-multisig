import { renderHook, waitFor } from '@/tests/test-utils'
import useLoadTxHistory from '@/hooks/loadables/useLoadTxHistory'
import * as useSafeInfo from '@/hooks/useSafeInfo'
import * as useChains from '@/hooks/useChains'
import * as store from '@/store'
import * as transactionsService from '@/services/transactions'
import * as useIntervalCounter from '@/hooks/useIntervalCounter'
import * as usePendingTxs from '@/hooks/usePendingTxs'
import { extendedSafeInfoBuilder } from '@/tests/builders/safe'
import { PendingStatus, type PendingTxsState } from '@/store/pendingTxsSlice'
import { toBeHex } from 'ethers'

const SAFE_ADDRESS = toBeHex('0x1234', 20)
const CHAIN_ID = '5'

describe('useLoadTxHistory', () => {
  const mockSafe = extendedSafeInfoBuilder()
    .with({
      address: { value: SAFE_ADDRESS },
      chainId: CHAIN_ID,
      txHistoryTag: 'tag-1',
    })
    .build()

  const mockResetCounter = jest.fn()

  const mockPendingTxs = (pendingTxIds: string[], pendingTxs: PendingTxsState) => {
    jest.spyOn(usePendingTxs, 'usePendingTxIds').mockReturnValue(pendingTxIds)
    jest.spyOn(store, 'useAppSelector').mockImplementation((selector) =>
      selector({
        settings: { hideSuspiciousTransactions: true },
        pendingTxs,
      } as unknown as store.RootState),
    )
  }

  beforeEach(() => {
    jest.clearAllMocks()

    jest.spyOn(useSafeInfo, 'default').mockReturnValue({
      safe: mockSafe,
      safeAddress: SAFE_ADDRESS,
      safeLoaded: true,
      safeLoading: false,
      safeError: undefined,
    })

    jest.spyOn(useChains, 'useHasFeature').mockReturnValue(true)

    mockPendingTxs([], {})

    jest.spyOn(transactionsService, 'getTxHistory').mockResolvedValue({ results: [] } as any)

    jest.spyOn(useIntervalCounter, 'default').mockReturnValue([0, mockResetCounter])
  })

  it('does not poll when there is no pending INDEXING tx', async () => {
    jest.spyOn(useIntervalCounter, 'default').mockReturnValue([1, mockResetCounter])

    const { result } = renderHook(() => useLoadTxHistory())

    await waitFor(() => {
      expect(result.current[0]).toBeDefined()
    })

    // A change in the interval counter must not be part of the effective deps when nothing is INDEXING
    expect(transactionsService.getTxHistory).toHaveBeenCalledTimes(1)
    expect(mockResetCounter).toHaveBeenCalled()
  })

  it('refetches history as the interval counter advances while a pending tx is INDEXING', async () => {
    mockPendingTxs(['tx1'], {
      tx1: { chainId: CHAIN_ID, safeAddress: SAFE_ADDRESS, nonce: 1, status: PendingStatus.INDEXING },
    })

    let counter = 0
    jest.spyOn(useIntervalCounter, 'default').mockImplementation(() => [counter, mockResetCounter])

    const { result, rerender } = renderHook(() => useLoadTxHistory())

    await waitFor(() => {
      expect(result.current[0]).toBeDefined()
    })

    expect(transactionsService.getTxHistory).toHaveBeenCalledTimes(1)

    mockResetCounter.mockClear() // clear the reset that always fires once on mount

    for (let i = 1; i <= 3; i++) {
      counter = i
      rerender()
      await waitFor(() => {
        expect(transactionsService.getTxHistory).toHaveBeenCalledTimes(1 + i)
      })
    }

    // The set of INDEXING tx ids never changed, so no reset beyond the initial mount
    expect(mockResetCounter).not.toHaveBeenCalled()
  })

  it('stops refetching on counter ticks once the pending tx is no longer INDEXING', async () => {
    mockPendingTxs(['tx1'], {
      tx1: { chainId: CHAIN_ID, safeAddress: SAFE_ADDRESS, nonce: 1, status: PendingStatus.INDEXING },
    })

    let counter = 0
    jest.spyOn(useIntervalCounter, 'default').mockImplementation(() => [counter, mockResetCounter])

    const { result, rerender } = renderHook(() => useLoadTxHistory())

    await waitFor(() => {
      expect(result.current[0]).toBeDefined()
    })

    expect(transactionsService.getTxHistory).toHaveBeenCalledTimes(1)

    counter = 1
    rerender()
    await waitFor(() => {
      expect(transactionsService.getTxHistory).toHaveBeenCalledTimes(2)
    })

    // Pending tx resolves, no longer INDEXING: one final refetch happens as polling stops,
    // then further counter ticks are ignored
    mockPendingTxs([], {})
    counter = 2
    rerender()

    await waitFor(() => {
      expect(transactionsService.getTxHistory).toHaveBeenCalledTimes(3)
    })
    expect(mockResetCounter).toHaveBeenCalled()

    counter = 3
    rerender()

    expect(transactionsService.getTxHistory).toHaveBeenCalledTimes(3)
  })

  it('does not refetch again just because the counter is already at the max attempts on mount', async () => {
    mockPendingTxs(['tx1'], {
      tx1: { chainId: CHAIN_ID, safeAddress: SAFE_ADDRESS, nonce: 1, status: PendingStatus.INDEXING },
    })

    // 30 attempts is the bound (~5 min at 10s intervals) — useIntervalCounter itself stops
    // ticking once it gets there (see its own tests), so this pollCount value never changes
    jest.spyOn(useIntervalCounter, 'default').mockReturnValue([30, mockResetCounter])

    const { result } = renderHook(() => useLoadTxHistory())

    await waitFor(() => {
      expect(result.current[0]).toBeDefined()
    })

    expect(transactionsService.getTxHistory).toHaveBeenCalledTimes(1)
  })

  it('passes hasIndexingPendingTx and the max-attempts bound through to useIntervalCounter', async () => {
    mockPendingTxs(['tx1'], {
      tx1: { chainId: CHAIN_ID, safeAddress: SAFE_ADDRESS, nonce: 1, status: PendingStatus.INDEXING },
    })

    const { result } = renderHook(() => useLoadTxHistory())

    await waitFor(() => {
      expect(result.current[0]).toBeDefined()
    })

    // useIntervalCounter itself is responsible for stopping at maxCount (see its own tests);
    // useLoadTxHistory just has to wire hasIndexingPendingTx + INDEXING_POLL_MAX_ATTEMPTS through.
    expect(useIntervalCounter.default).toHaveBeenLastCalledWith(expect.any(Number), true, 30)
  })

  it('passes enabled=false to useIntervalCounter when nothing is INDEXING', async () => {
    const { result } = renderHook(() => useLoadTxHistory())

    await waitFor(() => {
      expect(result.current[0]).toBeDefined()
    })

    expect(useIntervalCounter.default).toHaveBeenLastCalledWith(expect.any(Number), false, 30)
  })

  it('starts polling immediately (counter at 0) the instant a tx goes INDEXING', async () => {
    // Nothing pending yet
    mockPendingTxs([], {})
    jest.spyOn(useIntervalCounter, 'default').mockReturnValue([0, mockResetCounter])

    const { result, rerender } = renderHook(() => useLoadTxHistory())

    await waitFor(() => {
      expect(result.current[0]).toBeDefined()
    })
    expect(transactionsService.getTxHistory).toHaveBeenCalledTimes(1)

    // A tx starts INDEXING — useIntervalCounter (real behaviour, not this mock) would start
    // ticking from 0 since `enabled` flips true; here we simulate its first tick to confirm
    // useLoadTxHistory actually reacts to it (effectivePollCount folds into the fetch deps).
    mockPendingTxs(['tx1'], {
      tx1: { chainId: CHAIN_ID, safeAddress: SAFE_ADDRESS, nonce: 1, status: PendingStatus.INDEXING },
    })
    rerender()
    expect(useIntervalCounter.default).toHaveBeenLastCalledWith(expect.any(Number), true, 30)

    jest.spyOn(useIntervalCounter, 'default').mockReturnValue([1, mockResetCounter])
    rerender()
    await waitFor(() => {
      expect(transactionsService.getTxHistory).toHaveBeenCalledTimes(2)
    })
  })

  it('gives a second INDEXING tx a fresh budget while the first is still stuck', async () => {
    mockPendingTxs(['tx1'], {
      tx1: { chainId: CHAIN_ID, safeAddress: SAFE_ADDRESS, nonce: 1, status: PendingStatus.INDEXING },
    })

    let counter = 0
    jest.spyOn(useIntervalCounter, 'default').mockImplementation(() => [counter, mockResetCounter])

    const { result, rerender } = renderHook(() => useLoadTxHistory())

    await waitFor(() => {
      expect(result.current[0]).toBeDefined()
    })
    expect(transactionsService.getTxHistory).toHaveBeenCalledTimes(1)

    // tx1 is close to the max attempts
    counter = 29
    rerender()
    await waitFor(() => {
      expect(transactionsService.getTxHistory).toHaveBeenCalledTimes(2)
    })

    mockResetCounter.mockClear() // clear the reset that fired once on mount

    // A second tx starts INDEXING while tx1 is still stuck — the id set changes, so the effect
    // resets the shared counter, giving both a fresh budget instead of inheriting tx1's near-max count
    mockPendingTxs(['tx1', 'tx2'], {
      tx1: { chainId: CHAIN_ID, safeAddress: SAFE_ADDRESS, nonce: 1, status: PendingStatus.INDEXING },
      tx2: { chainId: CHAIN_ID, safeAddress: SAFE_ADDRESS, nonce: 2, status: PendingStatus.INDEXING },
    })
    rerender()

    expect(mockResetCounter).toHaveBeenCalledTimes(1)
  })
})
