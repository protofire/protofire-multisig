import { faker } from '@faker-js/faker'
import { getAddress, id, solidityPackedKeccak256, toBeHex, zeroPadValue } from 'ethers'
import cloneDeep from 'lodash/cloneDeep'
import type { Delay } from '@gnosis.pm/zodiac/dist/cjs/types/Delay'
import type { Block, JsonRpcProvider, TransactionReceipt } from 'ethers'

import {
  _addedTransactionsCache,
  _getRecoveryStateItem,
  _getRecoveryQueueItemTimestamps,
  _isMaliciousRecovery,
} from '../recovery-state'
import { encodeMultiSendData } from '@safe-global/protocol-kit/dist/src/utils/transactions/utils'
import { getMultiSendCallOnlyDeployment, getSafeSingletonDeployment } from '@safe-global/safe-deployments'
import { Interface } from 'ethers'
import { chainBuilder } from '@/tests/builders/chains'
import { getLatestSafeVersion } from '@safe-global/utils/utils/chains'
import { getModuleInstance, KnownContracts, ContractAbis } from '@gnosis.pm/zodiac'
import { createMockWeb3Provider } from '@safe-global/utils/tests/web3Provider'
import { MULTICALL_ABI } from '@safe-global/utils/utils/multicall'
import { SENTINEL_ADDRESS } from '@safe-global/protocol-kit/dist/src/utils/constants'
import { logError, Errors } from '@/services/exceptions'
import { http, HttpResponse } from 'msw'
import { server } from '@/tests/server'
import type { ExplorerApi, ExplorerLog } from '../explorer-logs'

jest.mock('@/services/exceptions', () => ({
  ...jest.requireActual('@/services/exceptions'),
  logError: jest.fn(),
}))

const latestSafeVersion = getLatestSafeVersion(
  chainBuilder().with({ chainId: '1', recommendedMasterCopyVersion: '1.4.1' }).build(),
)
const PRE_MULTI_SEND_CALL_ONLY_VERSIONS = ['1.0.0', '1.1.1']
const SUPPORTED_MULTI_SEND_CALL_ONLY_VERSIONS = [
  '1.3.0',
  // '1.4.1', TODO: Uncomment when safe-deployments is updated >1.25.0
  latestSafeVersion,
]

const DELAY_INTERFACE = new Interface(ContractAbis[KnownContracts.DELAY])

describe('recovery-state', () => {
  beforeEach(() => {
    _addedTransactionsCache.clear()
  })

  describe('isMaliciousRecovery', () => {
    describe('non-MultiSend', () => {
      it('should return true if the transaction is not calling the Safe itself', () => {
        const chainId = '1'
        const version = latestSafeVersion
        const safeAddress = faker.finance.ethereumAddress()

        const transaction = {
          to: faker.finance.ethereumAddress(), // Not Safe
          data: '0x',
        }

        expect(_isMaliciousRecovery({ chainId, version, safeAddress, transaction })).toBe(true)
      })

      it('should return false if the transaction is calling the Safe itself', () => {
        const chainId = '1'
        const version = latestSafeVersion
        const safeAddress = faker.finance.ethereumAddress()

        const transaction = {
          to: safeAddress, // Safe
          data: '0x',
        }

        expect(_isMaliciousRecovery({ chainId, version, safeAddress, transaction })).toBe(false)
      })
    })

    describe('MultiSend', () => {
      ;[...PRE_MULTI_SEND_CALL_ONLY_VERSIONS, ...SUPPORTED_MULTI_SEND_CALL_ONLY_VERSIONS].forEach((version) => {
        it(`should return true if the transaction is not an official MultiSend address for Safe version ${version}`, () => {
          const chainId = '1'
          const safeAddress = faker.finance.ethereumAddress()

          const safeAbi = getSafeSingletonDeployment({ network: chainId, version })!.abi
          const safeInterface = new Interface(safeAbi)

          const multiSendAbi =
            getMultiSendCallOnlyDeployment({ network: chainId, version }) ??
            getMultiSendCallOnlyDeployment({ network: chainId, version: '1.3.0' })
          const multiSendInterface = new Interface(multiSendAbi!.abi)

          const multiSendData = encodeMultiSendData([
            {
              to: safeAddress,
              value: '0',
              data: safeInterface.encodeFunctionData('addOwnerWithThreshold', [faker.finance.ethereumAddress(), 1]),
              operation: 0,
            },
            {
              to: safeAddress,
              value: '0',
              data: safeInterface.encodeFunctionData('addOwnerWithThreshold', [faker.finance.ethereumAddress(), 2]),
              operation: 0,
            },
          ])

          const transaction = {
            to: faker.finance.ethereumAddress(), // Not official MultiSend
            data: multiSendInterface.encodeFunctionData('multiSend', [multiSendData]),
          }

          expect(_isMaliciousRecovery({ chainId, version, safeAddress, transaction })).toBe(true)
        })
      })
      ;[...PRE_MULTI_SEND_CALL_ONLY_VERSIONS, ...SUPPORTED_MULTI_SEND_CALL_ONLY_VERSIONS].forEach((version) => {
        it(`should return true if the transaction is an official MultiSend call and not every transaction in the batch calls the Safe itself for Safe version ${version}`, () => {
          const chainId = '1'
          const version = latestSafeVersion
          const safeAddress = faker.finance.ethereumAddress()

          const safeAbi = getSafeSingletonDeployment({ network: chainId, version })!.abi
          const safeInterface = new Interface(safeAbi)

          const multiSendDeployment =
            getMultiSendCallOnlyDeployment({ network: chainId, version }) ??
            getMultiSendCallOnlyDeployment({ network: chainId, version: '1.3.0' })
          const multiSendInterface = new Interface(multiSendDeployment!.abi)

          const multiSendData = encodeMultiSendData([
            {
              to: faker.finance.ethereumAddress(), // Not Safe
              value: '0',
              data: safeInterface.encodeFunctionData('addOwnerWithThreshold', [faker.finance.ethereumAddress(), 1]),
              operation: 0,
            },
            {
              to: faker.finance.ethereumAddress(), // Not Safe
              value: '0',
              data: safeInterface.encodeFunctionData('addOwnerWithThreshold', [faker.finance.ethereumAddress(), 2]),
              operation: 0,
            },
          ])

          const transaction = {
            to: multiSendDeployment!.networkAddresses[chainId],
            data: multiSendInterface.encodeFunctionData('multiSend', [multiSendData]),
          }

          expect(_isMaliciousRecovery({ chainId, version, safeAddress, transaction })).toBe(true)
        })
      })

      SUPPORTED_MULTI_SEND_CALL_ONLY_VERSIONS.forEach((version) => {
        it(`should return false if the transaction is an official MultiSend call and every transaction in the batch calls the Safe itself for Safe version ${version}`, () => {
          const chainId = '1'
          const safeAddress = faker.finance.ethereumAddress()

          const safeAbi = getSafeSingletonDeployment({ network: chainId, version })!.abi
          const safeInterface = new Interface(safeAbi)

          const multiSendDeployment = getMultiSendCallOnlyDeployment({ network: chainId, version })!
          const multiSendInterface = new Interface(multiSendDeployment.abi)

          const multiSendData = encodeMultiSendData([
            {
              to: safeAddress,
              value: '0',
              data: safeInterface.encodeFunctionData('addOwnerWithThreshold', [faker.finance.ethereumAddress(), 1]),
              operation: 0,
            },
            {
              to: safeAddress,
              value: '0',
              data: safeInterface.encodeFunctionData('addOwnerWithThreshold', [faker.finance.ethereumAddress(), 2]),
              operation: 0,
            },
          ])

          const transaction = {
            to: multiSendDeployment.networkAddresses[chainId],
            data: multiSendInterface.encodeFunctionData('multiSend', [multiSendData]),
          }

          expect(_isMaliciousRecovery({ chainId, version, safeAddress, transaction })).toBe(false)
        })
      })

      PRE_MULTI_SEND_CALL_ONLY_VERSIONS.forEach((version) => {
        it(`should return false if the transaction is an official MultiSend call for Safe version ${version} (below the initial MultiSend contract version)`, () => {
          const chainId = '1'
          const safeAddress = faker.finance.ethereumAddress()

          const safeAbi = getSafeSingletonDeployment({ network: chainId, version })!.abi
          const safeInterface = new Interface(safeAbi)

          const multiSendDeployment = getMultiSendCallOnlyDeployment({ network: chainId, version: '1.3.0' })!
          const multiSendInterface = new Interface(multiSendDeployment.abi)

          const multiSendData = encodeMultiSendData([
            {
              to: safeAddress,
              value: '0',
              data: safeInterface.encodeFunctionData('addOwnerWithThreshold', [faker.finance.ethereumAddress(), 1]),
              operation: 0,
            },
          ])

          const transaction = {
            to: multiSendDeployment.networkAddresses[chainId],
            data: multiSendInterface.encodeFunctionData('multiSend', [multiSendData]),
          }

          expect(_isMaliciousRecovery({ chainId, version, safeAddress, transaction })).toBe(false)
        })
      })
    })
  })

  describe('getRecoveryQueueItemTimestamps', () => {
    it('should return a recovery queue item timestamps', () => {
      const delay = 1n
      const expiry = 2n

      const item = _getRecoveryQueueItemTimestamps({
        createdAt: 1n,
        delay,
        expiry,
      })

      expect(item).toStrictEqual({
        timestamp: 1_000n,
        validFrom: 2_000n,
        expiresAt: 4_000n,
      })
    })

    it('should return a recovery queue item timestamps with expiresAt null if expiry is zero', () => {
      const delay = 1n
      const expiry = 0n

      const item = _getRecoveryQueueItemTimestamps({
        createdAt: 1n,
        delay,
        expiry,
      })

      expect(item).toStrictEqual({
        timestamp: 1_000n,
        validFrom: 2_000n,
        expiresAt: null,
      })
    })
  })

  describe('getRecoveryState', () => {
    type MockTransactionAdded = {
      args: { queueNonce: bigint; txHash: string; to: string; value: bigint; data: string }
      blockNumber: number
      removed?: boolean
    }
    type DelayStorage = Partial<Record<string, (...args: Array<bigint>) => Array<unknown>>>

    const DELAY = 69420n
    const TX_NONCE = 2n
    const QUEUE_NONCE = 5n
    const EVENT_TOPIC = id('TransactionAdded(uint256,bytes32,address,uint256,bytes,uint8)')
    // Block n is mined at 1_000 + n, so the nonces below were queued in blocks 420, 500 and 600
    const CREATED_AT_BY_NONCE: Record<string, bigint> = { '2': 1_420n, '3': 1_500n, '4': 1_600n }
    const TX_HASH_BY_NONCE: Record<string, string> = { '2': id('tx 2'), '3': id('tx 3'), '4': id('tx 4') }
    const MULTICALL_INTERFACE = new Interface(MULTICALL_ABI)

    beforeEach(() => {
      jest.mocked(logError).mockClear()
    })

    // Answers the multicalls to the Delay Modifier from `storage`. A read missing from it fails
    const mockDelayStorage = (provider: JsonRpcProvider, storage: DelayStorage) => {
      provider.call = jest.fn(async ({ data }: { data: string }) => {
        const [calls] = MULTICALL_INTERFACE.decodeFunctionData('aggregate3', data)
        const results = calls.map(([, , callData]: [string, boolean, string]) => {
          const { name, args } = DELAY_INTERFACE.parseTransaction({ data: callData })!
          const read = storage[name]
          return read
            ? { success: true, returnData: DELAY_INTERFACE.encodeFunctionResult(name, read(...args)) }
            : { success: false, returnData: '0x' }
        })
        return MULTICALL_INTERFACE.encodeFunctionResult('aggregate3', [results])
      }) as unknown as JsonRpcProvider['call']
    }

    const setupQueuedState = ({
      queryFilterResult,
      storage,
    }: {
      queryFilterResult?: (topics: Array<string>) => Promise<Array<unknown>>
      storage?: DelayStorage
    } = {}) => {
      const safeAddress = faker.finance.ethereumAddress()
      const recoverers = [faker.finance.ethereumAddress()]
      const transactionAddedReceipt = { from: faker.finance.ethereumAddress() } as TransactionReceipt

      const transactionsAdded: Array<MockTransactionAdded> = [
        {
          args: { queueNonce: 2n, txHash: TX_HASH_BY_NONCE['2'], to: safeAddress, value: 0n, data: '0x' },
          blockNumber: 420,
        },
        // Malicious
        {
          args: {
            queueNonce: 3n,
            txHash: TX_HASH_BY_NONCE['3'],
            to: faker.finance.ethereumAddress(),
            value: 0n,
            data: '0x',
          },
          blockNumber: 500,
        },
        // Reorg
        {
          args: { queueNonce: 4n, txHash: TX_HASH_BY_NONCE['4'], to: safeAddress, value: 0n, data: '0x' },
          blockNumber: 600,
          removed: true,
        },
        {
          args: { queueNonce: 4n, txHash: TX_HASH_BY_NONCE['4'], to: safeAddress, value: 0n, data: '0x' },
          blockNumber: 600,
        },
      ]

      const queryFilterMock = jest.fn(
        queryFilterResult ??
          ((topics: Array<string>) =>
            Promise.resolve(transactionsAdded.filter(({ args }) => toBeHex(args.queueNonce, 32) === topics[1]))),
      )

      const mockProvider = createMockWeb3Provider([])
      mockDelayStorage(mockProvider, {
        getModulesPaginated: () => [recoverers, SENTINEL_ADDRESS],
        txExpiration: () => [0n],
        txCooldown: () => [DELAY],
        txNonce: () => [TX_NONCE],
        queueNonce: () => [QUEUE_NONCE],
        txCreatedAt: (nonce) => [CREATED_AT_BY_NONCE[nonce.toString()]],
        txHash: (nonce) => [TX_HASH_BY_NONCE[nonce.toString()]],
        ...storage,
      })
      mockProvider.getBlockNumber = jest.fn().mockResolvedValue(10_000)
      mockProvider.getBlock = jest.fn((n) => Promise.resolve({ number: n, timestamp: 1_000 + Number(n) } as Block))
      ;(
        mockProvider.getTransactionReceipt as jest.MockedFunction<JsonRpcProvider['getTransactionReceipt']>
      ).mockResolvedValue(transactionAddedReceipt)

      const delayModifierAddress = faker.finance.ethereumAddress()
      const delayModifier = {
        ...getModuleInstance(KnownContracts.DELAY, delayModifierAddress, mockProvider),
        filters: {
          TransactionAdded: () => ({ getTopicFilter: jest.fn().mockResolvedValue([EVENT_TOPIC]) }),
        },
        getAddress: jest.fn().mockResolvedValue(delayModifierAddress),
        queryFilter: queryFilterMock,
      } as unknown as Delay

      return {
        args: {
          delayModifier,
          safeAddress,
          provider: mockProvider,
          chainId: '1',
          version: '1.3.0' as const,
        },
        delayModifierAddress,
        recoverers,
        transactionsAdded,
        transactionAddedReceipt,
        queryFilterMock,
        mockProvider,
      }
    }

    it('should look up each queued transaction in the blocks mined at its txCreatedAt', async () => {
      const { args, delayModifierAddress, recoverers, transactionsAdded, transactionAddedReceipt, queryFilterMock } =
        setupQueuedState()

      const recoveryState = await _getRecoveryStateItem(args)

      expect({
        ...recoveryState,
        recoverers: recoveryState.recoverers.map((recoverer) => recoverer.toLowerCase()),
      }).toEqual({
        address: delayModifierAddress,
        recoverers,
        expiry: 0n,
        delay: DELAY,
        txNonce: TX_NONCE,
        queueNonce: QUEUE_NONCE,
        queue: [
          {
            ...transactionsAdded[0],
            timestamp: 1_420n * 1_000n,
            validFrom: (1_420n + DELAY) * 1_000n,
            expiresAt: null,
            isMalicious: false,
            executor: transactionAddedReceipt.from,
          },
          {
            ...transactionsAdded[1],
            timestamp: 1_500n * 1_000n,
            validFrom: (1_500n + DELAY) * 1_000n,
            expiresAt: null,
            isMalicious: true,
            executor: transactionAddedReceipt.from,
          },
          {
            ...transactionsAdded[3],
            timestamp: 1_600n * 1_000n,
            validFrom: (1_600n + DELAY) * 1_000n,
            expiresAt: null,
            isMalicious: false,
            executor: transactionAddedReceipt.from,
          },
        ],
        unavailableQueue: [],
      })
      expect(queryFilterMock).toHaveBeenCalledTimes(3)
      expect(queryFilterMock).toHaveBeenCalledWith(
        [EVENT_TOPIC, zeroPadValue('0x02', 32), TX_HASH_BY_NONCE['2']],
        419,
        421,
      )
      expect(queryFilterMock).toHaveBeenCalledWith(
        [EVENT_TOPIC, zeroPadValue('0x03', 32), TX_HASH_BY_NONCE['3']],
        499,
        501,
      )
      expect(queryFilterMock).toHaveBeenCalledWith(
        [EVENT_TOPIC, zeroPadValue('0x04', 32), TX_HASH_BY_NONCE['4']],
        599,
        601,
      )
    })

    it('should read the stored creation time and hash of all queued transactions in one call', async () => {
      const { args, mockProvider } = setupQueuedState()

      await _getRecoveryStateItem(args)

      // The Delay Modifier settings, then the queued transactions
      expect(mockProvider.call).toHaveBeenCalledTimes(2)
    })

    it('should list a queued transaction as unavailable when its event does not match the stored txHash', async () => {
      const { args, transactionsAdded } = setupQueuedState()
      // E.g. a log from another fork returned by a node of a load-balanced RPC
      transactionsAdded[1].args.txHash = id('another fork')

      const recoveryState = await _getRecoveryStateItem(args)

      expect(recoveryState.unavailableQueue).toEqual([
        expect.objectContaining({ args: { queueNonce: 3n, txHash: TX_HASH_BY_NONCE['3'] } }),
      ])
      expect(recoveryState.queue.map((item) => item.args.queueNonce)).toEqual([2n, 4n])
    })

    // The details of a queued transaction can fail to load for many reasons. It must still be listed from
    // what the Delay Modifier stores, so that owners see it and can cancel it
    it('should list queued transactions whose blocks the RPC no longer returns as unavailable', async () => {
      const { args, delayModifierAddress, queryFilterMock, mockProvider } = setupQueuedState()
      // Nonce 2 was queued in block 420, before the history the RPC serves
      mockProvider.getBlock = jest.fn((n) =>
        Number(n) < 450
          ? Promise.reject(new Error('any error'))
          : Promise.resolve({ number: n, timestamp: 1_000 + Number(n) } as Block),
      )

      const recoveryState = await _getRecoveryStateItem(args)

      expect(recoveryState.unavailableQueue).toEqual([
        {
          address: delayModifierAddress,
          args: { queueNonce: 2n, txHash: TX_HASH_BY_NONCE['2'] },
          timestamp: 1_420n * 1_000n,
          validFrom: (1_420n + DELAY) * 1_000n,
          expiresAt: null,
        },
      ])
      expect(recoveryState.queue.map((item) => item.args.queueNonce)).toEqual([3n, 4n])
      expect(queryFilterMock.mock.calls.map(([topics]) => topics[1])).not.toContain(zeroPadValue('0x02', 32))
    })

    it('should list a queued transaction as unavailable when a block it needs is not returned', async () => {
      const { args, mockProvider } = setupQueuedState()
      // Blocks around nonce 3 (block 500) are missing, e.g. on a load-balanced node with less history
      mockProvider.getBlock = jest.fn((n) =>
        Number(n) >= 480 && Number(n) <= 520
          ? Promise.resolve(null)
          : Promise.resolve({ number: n, timestamp: 1_000 + Number(n) } as Block),
      )

      const recoveryState = await _getRecoveryStateItem(args)

      expect(recoveryState.unavailableQueue.map((item) => item.args.queueNonce)).toEqual([3n])
      expect(recoveryState.queue.map((item) => item.args.queueNonce)).toEqual([2n, 4n])
    })

    it('should list queued transactions as unavailable when the RPC fails to return blocks', async () => {
      const { args, mockProvider } = setupQueuedState()
      mockProvider.getBlock = jest.fn().mockRejectedValue(new Error('rate limit: server busy'))

      const recoveryState = await _getRecoveryStateItem(args)

      expect(recoveryState.unavailableQueue.map((item) => item.args.queueNonce)).toEqual([2n, 3n, 4n])
      expect(recoveryState.queue).toEqual([])
    })

    it('should list queued transactions as unavailable when the latest block cannot be read', async () => {
      const { args, mockProvider, queryFilterMock } = setupQueuedState()
      const error = new Error('rate limit: server busy')
      mockProvider.getBlockNumber = jest.fn().mockRejectedValue(error)

      const recoveryState = await _getRecoveryStateItem(args)

      expect(recoveryState.unavailableQueue.map((item) => item.args.queueNonce)).toEqual([2n, 3n, 4n])
      expect(recoveryState.queue).toEqual([])
      expect(queryFilterMock).not.toHaveBeenCalled()
      expect(logError).toHaveBeenCalledWith(Errors._618, error)
    })

    it('should list queued transactions as unavailable and log when their events fail to load', async () => {
      const error = new Error('rate limit: server busy')
      const { args } = setupQueuedState({ queryFilterResult: () => Promise.reject(error) })

      const recoveryState = await _getRecoveryStateItem(args)

      expect(recoveryState.unavailableQueue.map((item) => item.args.queueNonce)).toEqual([2n, 3n, 4n])
      expect(recoveryState.queue).toEqual([])
      expect(logError).toHaveBeenCalledTimes(3)
      expect(logError).toHaveBeenCalledWith(Errors._618, error)
    })

    it('should list a queued transaction as unavailable when its event cannot be found', async () => {
      const { args } = setupQueuedState({ queryFilterResult: () => Promise.resolve([]) })

      const recoveryState = await _getRecoveryStateItem(args)

      expect(recoveryState.unavailableQueue.map((item) => item.args.queueNonce)).toEqual([2n, 3n, 4n])
      expect(logError).not.toHaveBeenCalled()
    })

    it('should list a queued transaction as unavailable when its only event was removed in a reorg', async () => {
      const { args } = setupQueuedState({
        queryFilterResult: () =>
          Promise.resolve([{ args: { queueNonce: 2n, txHash: TX_HASH_BY_NONCE['2'] }, removed: true }]),
      })

      const recoveryState = await _getRecoveryStateItem(args)

      expect(recoveryState.unavailableQueue.map((item) => item.args.queueNonce)).toEqual([2n, 3n, 4n])
    })

    it('should list a queued transaction as unavailable when it is newer than the latest block of the RPC', async () => {
      const { args, mockProvider } = setupQueuedState()
      mockProvider.getBlockNumber = jest.fn().mockResolvedValue(450)

      const recoveryState = await _getRecoveryStateItem(args)

      expect(recoveryState.unavailableQueue.map((item) => item.args.queueNonce)).toEqual([3n, 4n])
      expect(recoveryState.queue.map((item) => item.args.queueNonce)).toEqual([2n])
    })

    it.each([
      ['is not returned', () => Promise.resolve(null)],
      ['fails to load', () => Promise.reject(new Error('rate limit: server busy'))],
    ])('should list a found queued transaction without its proposer when its receipt %s', async (_, getReceipt) => {
      const { args, mockProvider } = setupQueuedState()
      mockProvider.getTransactionReceipt = jest.fn(getReceipt)

      const recoveryState = await _getRecoveryStateItem(args)

      expect(recoveryState.queue.map((item) => item.args.queueNonce)).toEqual([2n, 3n, 4n])
      expect(recoveryState.queue.map((item) => item.executor)).toEqual([undefined, undefined, undefined])
      expect(recoveryState.unavailableQueue).toEqual([])
    })

    it('should log when the receipt of a found queued transaction fails to load', async () => {
      const { args, mockProvider } = setupQueuedState()
      const error = new Error('rate limit: server busy')
      mockProvider.getTransactionReceipt = jest.fn().mockRejectedValue(error)

      await _getRecoveryStateItem(args)

      expect(logError).toHaveBeenCalledTimes(3)
      expect(logError).toHaveBeenCalledWith(Errors._615, error)
    })

    describe('session cache', () => {
      const queriedNonces = (queryFilterMock: jest.Mock) =>
        queryFilterMock.mock.calls.map(([topics]) => BigInt(topics[1]))

      it('should not search again for events found earlier in the session', async () => {
        const { args, queryFilterMock, mockProvider } = setupQueuedState()

        const first = await _getRecoveryStateItem(args)
        queryFilterMock.mockClear()
        ;(mockProvider.getBlock as jest.Mock).mockClear()
        ;(mockProvider.getBlockNumber as jest.Mock).mockClear()
        const second = await _getRecoveryStateItem(args)

        expect(second.queue).toEqual(first.queue)
        expect(queryFilterMock).not.toHaveBeenCalled()
        expect(mockProvider.getBlock).not.toHaveBeenCalled()
        expect(mockProvider.getBlockNumber).not.toHaveBeenCalled()
      })

      it('should only search for events missing from the cache', async () => {
        const { args, queryFilterMock, mockProvider } = setupQueuedState()
        // Blocks around nonce 3 (block 500) are missing on the first load
        mockProvider.getBlock = jest.fn((n) =>
          Number(n) >= 480 && Number(n) <= 520
            ? Promise.resolve(null)
            : Promise.resolve({ number: n, timestamp: 1_000 + Number(n) } as Block),
        )
        await _getRecoveryStateItem(args)

        mockProvider.getBlock = jest.fn((n) => Promise.resolve({ number: n, timestamp: 1_000 + Number(n) } as Block))
        queryFilterMock.mockClear()
        const recoveryState = await _getRecoveryStateItem(args)

        expect(queriedNonces(queryFilterMock)).toEqual([3n])
        expect(recoveryState.queue.map((item) => item.args.queueNonce)).toEqual([2n, 3n, 4n])
        expect(recoveryState.unavailableQueue).toEqual([])
      })

      it('should not cache events still within reorg range of the chain head', async () => {
        const { args, queryFilterMock, mockProvider } = setupQueuedState()
        // Nonce 4 was queued in block 600, 11 blocks deep
        mockProvider.getBlockNumber = jest.fn().mockResolvedValue(611)

        await _getRecoveryStateItem(args)
        queryFilterMock.mockClear()
        await _getRecoveryStateItem(args)

        expect(queriedNonces(queryFilterMock)).toEqual([4n])
      })

      it('should cache events exactly at the reorg range of the chain head', async () => {
        const { args, queryFilterMock, mockProvider } = setupQueuedState()
        mockProvider.getBlockNumber = jest.fn().mockResolvedValue(612)

        await _getRecoveryStateItem(args)
        queryFilterMock.mockClear()
        await _getRecoveryStateItem(args)

        expect(queryFilterMock).not.toHaveBeenCalled()
      })

      it('should search again when a cached event does not match the stored txHash', async () => {
        const { args, queryFilterMock, transactionsAdded } = setupQueuedState()
        await _getRecoveryStateItem(args)

        _addedTransactionsCache.forEach((event, key) => {
          if (event.args.queueNonce === 2n) {
            _addedTransactionsCache.set(key, {
              ...event,
              args: { ...event.args, txHash: id('another fork') },
            } as typeof event)
          }
        })
        queryFilterMock.mockClear()
        const recoveryState = await _getRecoveryStateItem(args)

        expect(queriedNonces(queryFilterMock)).toEqual([2n])
        expect(recoveryState.queue[0].args.txHash).toBe(transactionsAdded[0].args.txHash)
      })

      it('should keep cached events separate per Delay Modifier', async () => {
        const first = setupQueuedState()
        await _getRecoveryStateItem(first.args)

        const second = setupQueuedState()
        await _getRecoveryStateItem(second.args)

        expect(queriedNonces(second.queryFilterMock)).toEqual([2n, 3n, 4n])
      })
    })

    describe('block explorer fallback', () => {
      const EXPLORER: ExplorerApi = { url: 'https://explorer.test/api', params: {} }
      const EXPLORER_TX_HASH = (nonce: bigint) => id(`proposal ${nonce}`)

      // The explorer data must hash to what the Delay Modifier stores, unlike the RPC mocks above
      const getProposal = (nonce: bigint) => {
        const proposal = { to: getAddress(faker.finance.ethereumAddress()), value: nonce, data: '0x', operation: 0 }
        const txHash = solidityPackedKeccak256(
          ['address', 'uint256', 'bytes', 'uint8'],
          [proposal.to, proposal.value, proposal.data, proposal.operation],
        )
        return { ...proposal, txHash }
      }

      const toExplorerLog = (
        address: string,
        nonce: bigint,
        { to, value, data, operation, txHash }: ReturnType<typeof getProposal>,
      ): ExplorerLog => {
        const { topics, data: logData } = DELAY_INTERFACE.encodeEventLog('TransactionAdded', [
          nonce,
          txHash,
          to,
          value,
          data,
          operation,
        ])
        return {
          address,
          // Blockscout pads the topics with null
          topics: [...topics, null],
          data: logData,
          blockNumber: toBeHex(Number(CREATED_AT_BY_NONCE[nonce.toString()]) - 1_000),
          logIndex: '0x',
          transactionHash: EXPLORER_TX_HASH(nonce),
          transactionIndex: '0x1',
        }
      }

      const setupExplorerState = () => {
        const proposals: Record<string, ReturnType<typeof getProposal>> = {
          '2': getProposal(2n),
          '3': getProposal(3n),
          '4': getProposal(4n),
        }
        const setup = setupQueuedState({ storage: { txHash: (nonce) => [proposals[nonce.toString()].txHash] } })
        // History the RPC no longer serves
        setup.mockProvider.getBlock = jest.fn().mockRejectedValue(new Error('missing trie node'))

        const logs = Object.entries(proposals).map(([nonce, proposal]) =>
          toExplorerLog(setup.delayModifierAddress, BigInt(nonce), proposal),
        )
        const respond = jest.fn((topic1: string | null): Response => {
          const result = logs.filter(({ topics }) => topics[1] === topic1)
          return HttpResponse.json({ status: result.length ? '1' : '0', message: 'OK', result })
        })
        const requests: Array<URL> = []
        server.use(
          http.get(EXPLORER.url, ({ request }) => {
            const url = new URL(request.url)
            requests.push(url)
            return respond(url.searchParams.get('topic1'))
          }),
        )

        return { ...setup, args: { ...setup.args, explorer: EXPLORER }, proposals, logs, respond, requests }
      }

      it('should load queued transactions the RPC cannot find from the explorer', async () => {
        const { args, proposals, requests, delayModifierAddress, transactionAddedReceipt } = setupExplorerState()

        const recoveryState = await _getRecoveryStateItem(args)

        expect(recoveryState.unavailableQueue).toEqual([])
        expect(
          recoveryState.queue.map(({ args, transactionHash, executor }) => ({
            queueNonce: args.queueNonce,
            to: args.to,
            value: args.value,
            data: args.data,
            operation: args.operation,
            txHash: args.txHash,
            transactionHash,
            executor,
          })),
        ).toEqual(
          [2n, 3n, 4n].map((nonce) => {
            const { to, value, data, operation, txHash } = proposals[nonce.toString()]
            return {
              queueNonce: nonce,
              to,
              value,
              data,
              operation: BigInt(operation),
              txHash,
              transactionHash: EXPLORER_TX_HASH(nonce),
              executor: transactionAddedReceipt.from,
            }
          }),
        )
        expect(recoveryState.queue[0].blockNumber).toBe(420)
        expect(requests.map((url) => url.searchParams.get('address'))).toEqual(Array(3).fill(delayModifierAddress))
        expect(requests.map((url) => url.searchParams.get('topic2'))).toEqual(
          [2n, 3n, 4n].map((nonce) => proposals[nonce.toString()].txHash),
        )
      })

      it('should not query the explorer for events the RPC finds', async () => {
        const { args } = setupQueuedState()
        const request = jest.fn(() => HttpResponse.json({ status: '1', message: 'OK', result: [] }))
        server.use(http.get(EXPLORER.url, request))

        const recoveryState = await _getRecoveryStateItem({ ...args, explorer: EXPLORER })

        expect(recoveryState.queue.map((item) => item.args.queueNonce)).toEqual([2n, 3n, 4n])
        expect(request).not.toHaveBeenCalled()
      })

      it('should query the explorer when the latest block cannot be read', async () => {
        const { args, mockProvider, requests } = setupExplorerState()
        mockProvider.getBlockNumber = jest.fn().mockRejectedValue(new Error('rate limit: server busy'))

        const first = await _getRecoveryStateItem(args)
        const second = await _getRecoveryStateItem(args)

        expect(first.queue.map((item) => item.args.queueNonce)).toEqual([2n, 3n, 4n])
        expect(second.queue.map((item) => item.args.queueNonce)).toEqual([2n, 3n, 4n])
        // How deep the events are is unknown, so none of them is cached
        expect(requests).toHaveLength(6)
      })

      it('should cache the events found on the explorer', async () => {
        const { args, requests } = setupExplorerState()

        await _getRecoveryStateItem(args)
        await _getRecoveryStateItem(args)

        expect(requests).toHaveLength(3)
      })

      it('should not use explorer arguments that do not hash to the stored txHash', async () => {
        const { args, logs } = setupExplorerState()
        // The topics still carry the stored txHash, but the arguments that would be executed differ
        const tampered = DELAY_INTERFACE.encodeEventLog('TransactionAdded', [
          3n,
          logs[1].topics[2],
          faker.finance.ethereumAddress(),
          3n,
          '0x',
          0,
        ])
        logs[1].data = tampered.data

        const recoveryState = await _getRecoveryStateItem(args)

        expect(recoveryState.queue.map((item) => item.args.queueNonce)).toEqual([2n, 4n])
        expect(recoveryState.unavailableQueue.map((item) => item.args.queueNonce)).toEqual([3n])
      })

      it('should not use logs of another contract', async () => {
        const { args, logs } = setupExplorerState()
        logs[0].address = faker.finance.ethereumAddress()

        const recoveryState = await _getRecoveryStateItem(args)

        expect(recoveryState.unavailableQueue.map((item) => item.args.queueNonce)).toEqual([2n])
      })

      it('should list queued transactions as unavailable and log when the explorer fails', async () => {
        const { args, respond } = setupExplorerState()
        respond.mockImplementation(() =>
          HttpResponse.json({ status: '0', message: 'NOTOK', result: 'Max rate limit reached' }),
        )

        const recoveryState = await _getRecoveryStateItem(args)

        expect(recoveryState.queue).toEqual([])
        expect(recoveryState.unavailableQueue.map((item) => item.args.queueNonce)).toEqual([2n, 3n, 4n])
        expect(logError).toHaveBeenCalledWith(Errors._614, new Error('Block explorer error: Max rate limit reached'))
      })

      it('should list queued transactions as unavailable when the explorer does not find them', async () => {
        const { args, respond } = setupExplorerState()
        respond.mockImplementation(() => HttpResponse.json({ status: '0', message: 'No records found', result: [] }))

        const recoveryState = await _getRecoveryStateItem(args)

        expect(recoveryState.unavailableQueue.map((item) => item.args.queueNonce)).toEqual([2n, 3n, 4n])
        expect(logError).not.toHaveBeenCalledWith(Errors._614, expect.anything())
      })
    })

    it.each(['txCreatedAt', 'txHash'])(
      'should throw when %s of the queued transactions cannot be read',
      async (read) => {
        const { args } = setupQueuedState({ storage: { [read]: undefined } })

        await expect(_getRecoveryStateItem(args)).rejects.toThrow('Queued recovery transactions could not be read')
      },
    )

    it('should not query data if the queueNonce equals the txNonce', async () => {
      const safeAddress = faker.finance.ethereumAddress()
      const chainId = '1'
      const version = '1.3.0'

      const recoverers = [faker.finance.ethereumAddress()]
      const expiry = 0n
      const delay = 69420n
      const txNonce = 2n
      const queueNonce = 2n

      const mockProvider = createMockWeb3Provider([
        {
          signature: DELAY_INTERFACE.getFunction('getModulesPaginated')?.selector!,
          returnType: 'raw',
          returnValue: DELAY_INTERFACE.encodeFunctionResult('getModulesPaginated', [recoverers, SENTINEL_ADDRESS]),
        },
        {
          signature: DELAY_INTERFACE.getFunction('txExpiration')?.selector!,
          returnType: 'uint256',
          returnValue: expiry,
        },
        {
          signature: DELAY_INTERFACE.getFunction('txCooldown')?.selector!,
          returnType: 'uint256',
          returnValue: delay,
        },
        {
          signature: DELAY_INTERFACE.getFunction('txNonce')?.selector!,
          returnType: 'uint256',
          returnValue: txNonce,
        },
        {
          signature: DELAY_INTERFACE.getFunction('queueNonce')?.selector!,
          returnType: 'uint256',
          returnValue: queueNonce,
        },
      ])

      const queryFilterMock = jest.fn()
      const defaultTransactionAddedFilter = {
        address: faker.finance.ethereumAddress(),
        topics: [id('TransactionAdded(uint256,bytes32,address,uint256,bytes,uint8)')],
      }

      const mockDelayModifierAddress = faker.finance.ethereumAddress()

      const delayModifier = getModuleInstance(KnownContracts.DELAY, mockDelayModifierAddress, mockProvider)

      const patchedDelayModifier = {
        ...delayModifier,
        filters: {
          TransactionAdded: () => cloneDeep(defaultTransactionAddedFilter),
        },
        getAddress: jest.fn().mockResolvedValue(mockDelayModifierAddress),
        txCreatedAt: jest
          .fn()
          .mockResolvedValueOnce(420n)
          .mockResolvedValueOnce(69420n)
          .mockResolvedValueOnce(6942069n),
        queryFilter: queryFilterMock,
      }

      const recoveryState = await _getRecoveryStateItem({
        delayModifier: patchedDelayModifier as unknown as Delay,
        safeAddress,
        provider: mockProvider,
        chainId,
        version,
      })

      expect({
        ...recoveryState,
        recoverers: recoveryState.recoverers.map((recoverer) => recoverer.toLowerCase()),
      }).toEqual({
        address: await delayModifier.getAddress(),
        recoverers,
        expiry,
        delay,
        txNonce,
        queueNonce,
        queue: [],
        unavailableQueue: [],
      })
      expect(queryFilterMock).not.toHaveBeenCalled()
    })
  })
})
