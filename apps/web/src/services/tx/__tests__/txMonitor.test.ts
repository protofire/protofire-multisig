import { waitFor } from '@testing-library/react'
import { act } from 'react'
import { _getRemainingTimeout } from '@/services/tx/txMonitor'
import * as txEvents from '@/services/tx/txEvents'
import * as txMonitor from '@/services/tx/txMonitor'

import { toBeHex } from 'ethers'
import { MockEip1193Provider } from '@/tests/mocks/providers'
import { BrowserProvider, type JsonRpcProvider, type TransactionReceipt } from 'ethers'
import { faker } from '@faker-js/faker'
import { SimpleTxWatcher } from '@/utils/SimpleTxWatcher'
import type { RelayTaskStatus } from '@safe-global/utils/services/RelayTxWatcher'
import * as RelayTxWatcherModule from '@safe-global/utils/services/RelayTxWatcher'

// Mock getBaseUrl to return a test CGW base URL
jest.mock('@safe-global/store/gateway/cgwClient', () => ({
  ...jest.requireActual('@safe-global/store/gateway/cgwClient'),
  getBaseUrl: () => 'https://test-cgw.example.com',
}))

// Mock getRelayTxStatus from the shared package
jest.mock('@safe-global/utils/services/RelayTxWatcher', () => {
  const actual = jest.requireActual('@safe-global/utils/services/RelayTxWatcher')
  return {
    ...actual,
    getRelayTxStatus: jest.fn(),
  }
})

const { waitForTx, waitForRelayedTx } = txMonitor

const provider = new BrowserProvider(MockEip1193Provider) as unknown as JsonRpcProvider

describe('txMonitor', () => {
  const simpleTxWatcherInstance = SimpleTxWatcher.getInstance()

  let txDispatchSpy = jest.spyOn(txEvents, 'txDispatch')
  // let simpleWatcherSpy = jest.spyOn(SimpleTxWatcher, 'getInstance')
  const safeAddress = toBeHex('0x123', 20)

  let watchTxHashSpy = jest.spyOn(simpleTxWatcherInstance, 'watchTxHash')

  beforeEach(() => {
    jest.useFakeTimers()
    jest.resetAllMocks()

    txDispatchSpy = jest.spyOn(txEvents, 'txDispatch')
    jest.spyOn(provider, 'waitForTransaction')
    watchTxHashSpy = jest.spyOn(simpleTxWatcherInstance, 'watchTxHash')
  })

  describe('waitForTx', () => {
    // Not mined/validated:
    it("emits a FAILED event if waitForTransaction isn't blocking and no receipt was returned", async () => {
      // Can return null if waitForTransaction is non-blocking:
      // https://docs.ethers.io/v5/single-page/#/v5/api/providers/provider/-%23-Provider-waitForTransaction
      const receipt = null as unknown as TransactionReceipt
      watchTxHashSpy.mockImplementation(() => Promise.resolve(receipt))
      await waitForTx(provider, ['0x0'], '0x0', safeAddress, faker.finance.ethereumAddress(), 1, 1, '11155111')

      expect(txDispatchSpy).toHaveBeenCalledWith('FAILED', {
        txId: '0x0',
        error: expect.any(Error),
        nonce: 1,
        chainId: '11155111',
        safeAddress,
      })
    })

    it('emits a REVERTED event if the tx reverted', async () => {
      const receipt = {
        status: 0,
      } as TransactionReceipt

      watchTxHashSpy.mockImplementation(() => Promise.resolve(receipt))
      await waitForTx(provider, ['0x0'], '0x0', safeAddress, faker.finance.ethereumAddress(), 1, 1, '11155111')

      expect(txDispatchSpy).toHaveBeenCalledWith('REVERTED', {
        nonce: 1,
        txId: '0x0',
        error: new Error('Transaction reverted by EVM.'),
        chainId: '11155111',
        safeAddress,
      })
    })

    it('emits a FAILED event if waitForTransaction throws', async () => {
      watchTxHashSpy.mockImplementation(() => Promise.reject(new Error('Test error.')))
      await waitForTx(provider, ['0x0'], '0x0', safeAddress, faker.finance.ethereumAddress(), 1, 1, '11155111')

      expect(txDispatchSpy).toHaveBeenCalledWith('FAILED', {
        txId: '0x0',
        error: new Error('Test error.'),
        nonce: 1,
        chainId: '11155111',
        safeAddress,
      })
    })
  })

  describe('waitForRelayedTx', () => {
    const chainId = '1'
    const safeAddress = toBeHex('0x1', 20)

    const mockGetRelayTxStatus = RelayTxWatcherModule.getRelayTxStatus as jest.MockedFunction<
      typeof RelayTxWatcherModule.getRelayTxStatus
    >

    it('emits a PROCESSED event if status is 200 (Included)', async () => {
      const mockResponse: RelayTaskStatus = {
        status: 200,
        receipt: {
          transactionHash: '0xdef',
        },
      }
      mockGetRelayTxStatus.mockResolvedValue(mockResponse)

      waitForRelayedTx('0x1', ['0x2'], chainId, safeAddress, 1)

      act(() => {
        jest.advanceTimersByTime(15_000 + 1)
      })

      await waitFor(() => {
        expect(mockGetRelayTxStatus).toHaveBeenCalledTimes(1)
        expect(txDispatchSpy).toHaveBeenCalledWith('PROCESSED', {
          txId: '0x2',
          safeAddress,
          nonce: 1,
          chainId,
          txHash: '0xdef',
        })
      })

      // The relay timeout should have been cancelled
      txDispatchSpy.mockClear()
      act(() => {
        jest.advanceTimersByTime(3 * 60_000 + 1)
      })
      expect(txDispatchSpy).not.toHaveBeenCalled()
    })

    it('emits a REVERTED event if status is 500 (Reverted)', async () => {
      const mockResponse: RelayTaskStatus = {
        status: 500,
        receipt: {
          transactionHash: '0xdef',
        },
      }
      mockGetRelayTxStatus.mockResolvedValue(mockResponse)

      waitForRelayedTx('0x1', ['0x2'], chainId, safeAddress, 1)

      act(() => {
        jest.advanceTimersByTime(15_000 + 1)
      })

      await waitFor(() => {
        expect(mockGetRelayTxStatus).toHaveBeenCalledTimes(1)
        expect(txDispatchSpy).toHaveBeenCalledWith('REVERTED', {
          nonce: 1,
          txId: '0x2',
          error: new Error('Relayed transaction reverted by EVM.'),
          chainId,
          safeAddress,
        })
      })

      // The relay timeout should have been cancelled
      txDispatchSpy.mockClear()
      act(() => {
        jest.advanceTimersByTime(3 * 60_000 + 1)
      })
      expect(txDispatchSpy).not.toHaveBeenCalled()
    })

    it('emits a FAILED event if status is 400 (Rejected)', async () => {
      const mockResponse: RelayTaskStatus = {
        status: 400,
      }
      mockGetRelayTxStatus.mockResolvedValue(mockResponse)

      waitForRelayedTx('0x1', ['0x2'], chainId, safeAddress, 1)

      act(() => {
        jest.advanceTimersByTime(15_000 + 1)
      })

      await waitFor(() => {
        expect(mockGetRelayTxStatus).toHaveBeenCalledTimes(1)
        expect(txDispatchSpy).toHaveBeenCalledWith('FAILED', {
          nonce: 1,
          txId: '0x2',
          error: new Error('Relayed transaction was rejected by relay provider.'),
          chainId,
          safeAddress,
        })
      })

      // The relay timeout should have been cancelled
      txDispatchSpy.mockClear()
      act(() => {
        jest.advanceTimersByTime(3 * 60_000 + 1)
      })
      expect(txDispatchSpy).not.toHaveBeenCalled()
    })

    it('keeps polling if status is 100 (Pending)', async () => {
      const mockResponse: RelayTaskStatus = {
        status: 100,
      }
      mockGetRelayTxStatus.mockResolvedValue(mockResponse)

      waitForRelayedTx('0x1', ['0x2'], chainId, safeAddress, 1)

      act(() => {
        jest.advanceTimersByTime(15_000 + 1)
      })

      await waitFor(() => {
        expect(mockGetRelayTxStatus).toHaveBeenCalledTimes(1)
      })

      // Should NOT have dispatched any terminal event
      expect(txDispatchSpy).not.toHaveBeenCalled()
    })

    it.each([200, 400, 500])('keeps Safe-pays pending past three minutes until provider status %s', async (status) => {
      const taskId = `safe-pays-${status}`
      mockGetRelayTxStatus.mockResolvedValue({ status: 110 })
      waitForRelayedTx(taskId, ['0x2'], chainId, safeAddress, 1, undefined, true)
      // The pending-status hook can start a second watcher after submission or remount.
      waitForRelayedTx(taskId, ['0x2'], chainId, safeAddress, 1, undefined, true)
      await jest.advanceTimersByTimeAsync(4 * 60_000)
      expect(mockGetRelayTxStatus).toHaveBeenCalledTimes(16)
      expect(txDispatchSpy).not.toHaveBeenCalled()

      mockGetRelayTxStatus.mockResolvedValue({ status, receipt: { transactionHash: '0xlate' } })
      await jest.advanceTimersByTimeAsync(15_000)
      expect(txDispatchSpy).toHaveBeenCalledTimes(1)
      expect(txDispatchSpy).toHaveBeenCalledWith(
        status === 200 ? 'PROCESSED' : status === 400 ? 'FAILED' : 'REVERTED',
        expect.objectContaining({ txId: '0x2', chainId, safeAddress }),
      )
      const calls = mockGetRelayTxStatus.mock.calls.length
      await jest.advanceTimersByTimeAsync(60_000)
      expect(mockGetRelayTxStatus).toHaveBeenCalledTimes(calls)
    })

    it('preserves Safe-pays tracking across transient status errors and missing receipts', async () => {
      mockGetRelayTxStatus
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ status: 200 })
        .mockResolvedValue({ status: 200, receipt: { transactionHash: '0xrecovered' } })
      waitForRelayedTx('transient-safe-pays', ['0x2'], chainId, safeAddress, 1, undefined, true)
      await jest.advanceTimersByTimeAsync(30_000)
      expect(txDispatchSpy).not.toHaveBeenCalled()
      await jest.advanceTimersByTimeAsync(15_000)
      expect(txDispatchSpy).toHaveBeenCalledWith('PROCESSED', expect.objectContaining({ txHash: '0xrecovered' }))
    })

    it('stops Safe-pays polling when transaction history confirms execution', async () => {
      mockGetRelayTxStatus.mockResolvedValue({ status: 110 })
      waitForRelayedTx('indexed-safe-pays', ['0x2'], chainId, safeAddress, 1, undefined, true)
      await jest.advanceTimersByTimeAsync(15_000)
      txDispatchSpy.mockRestore()
      txEvents.txDispatch(txEvents.TxEvent.SUCCESS, { txId: '0x2', nonce: 1, chainId, safeAddress })
      await jest.advanceTimersByTimeAsync(60_000)
      expect(mockGetRelayTxStatus).toHaveBeenCalledTimes(1)
    })

    it('emits a FAILED event if the tx relaying timed out', async () => {
      const mockResponse: RelayTaskStatus = {
        status: 110,
      }
      mockGetRelayTxStatus.mockResolvedValue(mockResponse)

      waitForRelayedTx('0x1', ['0x2'], chainId, safeAddress, 1)

      act(() => {
        jest.advanceTimersByTime(3 * 60_000 + 1)
      })

      expect(txDispatchSpy).toHaveBeenCalledWith('FAILED', {
        nonce: 1,
        txId: '0x2',
        error: new Error('Transaction not relayed in 3 minutes. Be aware that it might still be relayed.'),
        chainId,
        safeAddress,
      })
    })
  })
})

describe('getRemainingTimeout', () => {
  const DefaultTimeout = 1

  it('returns 1 if submission is older than 1 minute', () => {
    const result = _getRemainingTimeout(DefaultTimeout, Date.now() - DefaultTimeout * 60_000)

    expect(result).toBe(1)
  })

  it('returns default timeout in milliseconds if no submission time was passed', () => {
    const result = _getRemainingTimeout(DefaultTimeout)

    expect(result).toBe(DefaultTimeout * 60_000)
  })

  it('returns remaining timeout', () => {
    const passedMinutes = DefaultTimeout - 0.4
    const result = _getRemainingTimeout(DefaultTimeout, Date.now() - passedMinutes * 60_000)

    expect(result).toBe((DefaultTimeout - passedMinutes) * 60_000)
  })
})
