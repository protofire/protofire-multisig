import { SENTINEL_ADDRESS } from '@safe-global/protocol-kit/dist/src/utils/constants'
import { getMultiSendCallOnlyDeployment } from '@safe-global/safe-deployments'
import { type SafeState } from '@safe-global/store/gateway/AUTO_GENERATED/safes'
import type { Delay } from '@gnosis.pm/zodiac'
import type { TransactionAddedEvent } from '@gnosis.pm/zodiac/dist/cjs/types/Delay'
import { EventLog, Log, solidityPackedKeccak256, toBeHex, ZeroHash, type JsonRpcProvider } from 'ethers'
import { sameAddress } from '@safe-global/utils/utils/addresses'
import { isMultiSendCalldata } from '@/utils/transaction-calldata'
import { decodeMultiSendData } from '@safe-global/protocol-kit/dist/src/utils'
import { multicall } from '@safe-global/utils/utils/multicall'
import { logError, Errors } from '@/services/exceptions'
import { createBlockTimestampReader, findBlockWindowForTimestamp, type GetBlockTimestamp } from './block-by-timestamp'
import { getExplorerLogs, type ExplorerApi, type ExplorerLog } from './explorer-logs'

export const MAX_RECOVERER_PAGE_SIZE = 100

type AddedEvent = TransactionAddedEvent.Log
export type RecoveryQueueItem = AddedEvent & {
  timestamp: bigint
  validFrom: bigint
  expiresAt: bigint | null
  isMalicious: boolean
  // Undefined when the RPC doesn't return the receipt of the proposing transaction
  executor?: string
}

/**
 * A queued transaction whose `TransactionAdded` event couldn't be loaded from the RPC.
 * Only what the Delay Modifier stores is known: enough to show and cancel it, but not to execute it.
 */
export type UnavailableRecoveryQueueItem = Pick<
  RecoveryQueueItem,
  'address' | 'timestamp' | 'validFrom' | 'expiresAt'
> & {
  args: Pick<RecoveryQueueItem['args'], 'queueNonce' | 'txHash'>
}

export type AnyRecoveryQueueItem = RecoveryQueueItem | UnavailableRecoveryQueueItem

export type RecoveryStateItem = {
  address: string
  recoverers: Array<string>
  expiry: bigint
  delay: bigint
  txNonce: bigint
  queueNonce: bigint
  queue: Array<RecoveryQueueItem>
  unavailableQueue: Array<UnavailableRecoveryQueueItem>
}

export type RecoveryState = Array<RecoveryStateItem>

export function _isMaliciousRecovery({
  chainId,
  version,
  safeAddress,
  transaction,
}: {
  chainId: string
  version: SafeState['version']
  safeAddress: string
  transaction: Pick<AddedEvent['args'], 'to' | 'data'>
}) {
  const BASE_MULTI_SEND_CALL_ONLY_VERSION = '1.3.0'

  const isMultiSend = isMultiSendCalldata(transaction.data)
  const transactions = isMultiSend ? decodeMultiSendData(transaction.data) : [transaction]

  if (!isMultiSend) {
    // Calling the Safe itself
    return !sameAddress(transaction.to, safeAddress)
  }

  const multiSendDeployment =
    getMultiSendCallOnlyDeployment({ network: chainId, version: version ?? undefined }) ??
    getMultiSendCallOnlyDeployment({ network: chainId, version: BASE_MULTI_SEND_CALL_ONLY_VERSION })

  if (!multiSendDeployment) {
    return true
  }

  const multiSendAddress = multiSendDeployment.networkAddresses[chainId] ?? multiSendDeployment.defaultAddress

  // Calling official MultiSend contract with a batch of transactions to the Safe itself
  return (
    !sameAddress(transaction.to, multiSendAddress) ||
    transactions.some((transaction) => !sameAddress(transaction.to, safeAddress))
  )
}

export const _getRecoveryQueueItemTimestamps = ({
  createdAt,
  delay,
  expiry,
}: {
  createdAt: bigint
  delay: bigint
  expiry: bigint
}): Pick<RecoveryQueueItem, 'timestamp' | 'validFrom' | 'expiresAt'> => {
  const timestamp = createdAt
  const validFrom = timestamp + delay
  const expiresAt =
    expiry === BigInt(0)
      ? null // Never expires
      : (validFrom + expiry) * BigInt(1000)

  return {
    timestamp: timestamp * BigInt(1000),
    validFrom: validFrom * BigInt(1000),
    expiresAt,
  }
}

const RECOVERY_LOG_LOOKUP_CONCURRENCY = 4

// Past any reorg on record (deepest ever 7 blocks, 1 since the Merge). A log shallower than this
// can still be replaced, and the cached arguments would then make executeNextTx revert.
const REORG_DEPTH_BLOCKS = 12

type QueuedTransaction = {
  queueNonce: bigint
  createdAt: bigint
  txHash: string
}

type QueuedTransactionLookup = QueuedTransaction & {
  transactionAdded: AddedEvent | null
}

type DelayModifierContext = {
  delayModifier: Delay
  delayModifierAddress: string
  provider: JsonRpcProvider
  chainId: string
  explorer?: ExplorerApi | null
}

/** `TransactionAdded` events found during the session, so that each refresh only searches for new ones */
export const _addedTransactionsCache = new Map<string, AddedEvent>()

const getCacheKey = ({ chainId, delayModifierAddress }: DelayModifierContext, nonce: bigint) =>
  `${chainId}:${delayModifierAddress.toLowerCase()}:${nonce}`

const getCachedTransactionAdded = (context: DelayModifierContext, { queueNonce, txHash }: QueuedTransaction) => {
  const event = _addedTransactionsCache.get(getCacheKey(context, queueNonce))
  return event?.args.txHash === txHash ? event : null
}

const cacheSettledTransactionsAdded = (
  context: DelayModifierContext,
  lookups: Array<QueuedTransactionLookup>,
  latestBlock: number,
) => {
  for (const { queueNonce, transactionAdded } of lookups) {
    if (transactionAdded && latestBlock - transactionAdded.blockNumber >= REORG_DEPTH_BLOCKS) {
      _addedTransactionsCache.set(getCacheKey(context, queueNonce), transactionAdded)
    }
  }
}

/**
 * What the Delay Modifier stores about each queued transaction, read in a single multicall.
 * Without it a queued transaction can't be shown at all, so a failure fails the whole load.
 */
const readQueuedTransactions = async ({
  delayModifier,
  delayModifierAddress,
  txNonce,
  queueNonce,
  provider,
}: {
  delayModifier: Delay
  delayModifierAddress: string
  txNonce: bigint
  queueNonce: bigint
  provider: JsonRpcProvider
}): Promise<Array<QueuedTransaction>> => {
  if (queueNonce === txNonce) {
    // There are no queued txs
    return []
  }

  const queuedNonces = Array.from({ length: Number(queueNonce - txNonce) }, (_, idx) => txNonce + BigInt(idx))
  const calls = queuedNonces.flatMap((nonce) => [
    { to: delayModifierAddress, data: delayModifier.interface.encodeFunctionData('txCreatedAt', [nonce]) },
    { to: delayModifierAddress, data: delayModifier.interface.encodeFunctionData('txHash', [nonce]) },
  ])
  const callResults = await multicall(provider, calls)

  if (callResults.some(({ success }) => !success)) {
    throw new Error('Queued recovery transactions could not be read')
  }

  return queuedNonces.map((nonce, index) => ({
    queueNonce: nonce,
    createdAt: BigInt(callResults[index * 2].returnData),
    txHash: delayModifier.interface.decodeFunctionResult('txHash', callResults[index * 2 + 1].returnData)[0],
  }))
}

/**
 * The `TransactionAdded` event of a queued transaction, or null if it can't be loaded from the RPC for
 * any reason: history the RPC no longer serves, rate limits, a lagging node. The transaction is then
 * shown from what the Delay Modifier stores, so a failure here never hides it.
 */
const findTransactionAdded = async ({
  delayModifier,
  eventTopic,
  transaction,
  latestBlock,
  getTimestamp,
}: {
  delayModifier: Delay
  eventTopic: string
  transaction: QueuedTransaction
  latestBlock: number
  getTimestamp: GetBlockTimestamp
}): Promise<AddedEvent | null> => {
  const { queueNonce, createdAt, txHash } = transaction

  try {
    const window = await findBlockWindowForTimestamp({ timestamp: Number(createdAt), latestBlock, getTimestamp })
    if (!window) return null

    const events: Array<AddedEvent> = await delayModifier.queryFilter(
      // @ts-expect-error raw topic arrays are supported by ethers at runtime
      [eventTopic, toBeHex(queueNonce, 32), txHash],
      window.fromBlock,
      window.toBlock,
    )
    // A log from another fork or a lagging node must not describe what the Delay Modifier will execute
    return events.find((event) => !event.removed && event.args.txHash === txHash) ?? null
  } catch (error) {
    logError(Errors._618, error)
    return null
  }
}

/**
 * The Delay Modifier stores when each queued transaction was created (`txCreatedAt`) but not its data.
 * Instead of scanning logs, find the blocks mined at that time and only query the `TransactionAdded`
 * event there.
 */
const searchTransactionsAdded = async (
  { delayModifier, provider }: DelayModifierContext,
  eventTopic: string,
  queuedTransactions: Array<QueuedTransaction>,
  latestBlock: number,
): Promise<Array<QueuedTransactionLookup>> => {
  const getTimestamp = createBlockTimestampReader(provider)

  const lookups: Array<QueuedTransactionLookup> = []
  for (let index = 0; index < queuedTransactions.length; index += RECOVERY_LOG_LOOKUP_CONCURRENCY) {
    const batch = queuedTransactions.slice(index, index + RECOVERY_LOG_LOOKUP_CONCURRENCY)
    const found = await Promise.all(
      batch.map(async (transaction) => ({
        ...transaction,
        transactionAdded: await findTransactionAdded({
          delayModifier,
          eventTopic,
          transaction,
          latestBlock,
          getTimestamp,
        }),
      })),
    )
    lookups.push(...found)
  }

  return lookups
}

const hexToNumber = (hex: string) => parseInt(hex, 16) || 0

const toTransactionAdded = ({ delayModifier, provider }: DelayModifierContext, log: ExplorerLog): AddedEvent => {
  const ethersLog = new Log(
    {
      address: log.address,
      topics: log.topics.filter((topic): topic is string => Boolean(topic)),
      data: log.data,
      blockNumber: hexToNumber(log.blockNumber),
      blockHash: log.blockHash ?? ZeroHash,
      transactionHash: log.transactionHash,
      index: hexToNumber(log.logIndex),
      transactionIndex: hexToNumber(log.transactionIndex),
      removed: false,
    },
    provider,
  )
  const fragment = delayModifier.interface.getEvent('TransactionAdded')

  // Decodes the arguments exactly as a log queried from the RPC
  return new EventLog(ethersLog, delayModifier.interface, fragment) as unknown as AddedEvent
}

/**
 * The Delay Modifier stores `keccak256(abi.encodePacked(to, value, data, operation))` as the `txHash` of
 * each queued transaction, and only executes arguments that hash to it. Arguments from an explorer
 * matching it can therefore be trusted as much as the Delay Modifier storage.
 */
const isAuthenticTransactionAdded = (
  { delayModifierAddress }: DelayModifierContext,
  event: AddedEvent,
  { queueNonce, txHash }: QueuedTransaction,
) => {
  const { to, value, data, operation } = event.args
  const hash = solidityPackedKeccak256(['address', 'uint256', 'bytes', 'uint8'], [to, value, data, operation])

  return (
    sameAddress(event.address, delayModifierAddress) &&
    event.args.queueNonce === queueNonce &&
    event.args.txHash === txHash &&
    hash === txHash
  )
}

/**
 * The `TransactionAdded` event of a queued transaction from the block explorer, which indexes the whole
 * history unlike most RPCs. Null if the explorer doesn't return it, or returns arguments that don't
 * match what the Delay Modifier stores.
 */
const findExplorerTransactionAdded = async (
  context: DelayModifierContext,
  explorer: ExplorerApi,
  eventTopic: string,
  transaction: QueuedTransaction,
): Promise<AddedEvent | null> => {
  try {
    const logs = await getExplorerLogs(explorer, {
      address: context.delayModifierAddress,
      topics: [eventTopic, toBeHex(transaction.queueNonce, 32), transaction.txHash],
    })

    return (
      logs
        .map((log) => toTransactionAdded(context, log))
        .find((event) => isAuthenticTransactionAdded(context, event, transaction)) ?? null
    )
  } catch (error) {
    logError(Errors._614, error)
    return null
  }
}

/** Looks up on the block explorer the events the RPC didn't return, one at a time to respect its rate limit */
const searchExplorerTransactionsAdded = async (
  context: DelayModifierContext,
  eventTopic: string,
  lookups: Array<QueuedTransactionLookup>,
): Promise<Array<QueuedTransactionLookup>> => {
  const { explorer } = context
  if (!explorer) {
    return lookups
  }

  const results: Array<QueuedTransactionLookup> = []
  for (const lookup of lookups) {
    results.push(
      lookup.transactionAdded
        ? lookup
        : { ...lookup, transactionAdded: await findExplorerTransactionAdded(context, explorer, eventTopic, lookup) },
    )
  }

  return results
}

const queryAddedTransactions = async (
  context: DelayModifierContext,
  queuedTransactions: Array<QueuedTransaction>,
): Promise<Array<QueuedTransactionLookup>> => {
  const cachedLookups = queuedTransactions.map((transaction) => ({
    ...transaction,
    transactionAdded: getCachedTransactionAdded(context, transaction),
  }))
  const missing = cachedLookups.filter(({ transactionAdded }) => !transactionAdded)

  if (missing.length === 0) {
    return cachedLookups
  }

  const transactionAddedFilter = context.delayModifier.filters.TransactionAdded() as TransactionAddedEvent.Filter
  const [eventTopic] = (await transactionAddedFilter.getTopicFilter()) as Array<string>

  const latestBlock = await context.provider.getBlockNumber().catch((error) => {
    logError(Errors._618, error)
    return undefined
  })

  // Without the latest block nothing can be searched on the RPC, but the explorer doesn't need it
  const searched =
    latestBlock === undefined ? missing : await searchTransactionsAdded(context, eventTopic, missing, latestBlock)
  const found = await searchExplorerTransactionsAdded(context, eventTopic, searched)

  if (latestBlock !== undefined) {
    cacheSettledTransactionsAdded(context, found, latestBlock)
  }

  const foundByNonce = new Map(found.map((lookup) => [lookup.queueNonce, lookup]))

  return cachedLookups.map((lookup) => foundByNonce.get(lookup.queueNonce) ?? lookup)
}

const getUnavailableRecoveryQueueItem = ({
  delayModifierAddress,
  transaction,
  delay,
  expiry,
}: {
  delayModifierAddress: string
  transaction: QueuedTransaction
  delay: bigint
  expiry: bigint
}): UnavailableRecoveryQueueItem => {
  const { queueNonce, createdAt, txHash } = transaction

  return {
    address: delayModifierAddress,
    args: { queueNonce, txHash },
    ..._getRecoveryQueueItemTimestamps({ createdAt, delay, expiry }),
  }
}

const getRecoveryQueueItem = async ({
  transactionAdded,
  createdAt,
  delay,
  expiry,
  provider,
  chainId,
  version,
  safeAddress,
}: {
  transactionAdded: AddedEvent
  createdAt: bigint
  delay: bigint
  expiry: bigint
  provider: JsonRpcProvider
  chainId: string
  version: SafeState['version']
  safeAddress: string
}): Promise<RecoveryQueueItem> => {
  const timestamps = _getRecoveryQueueItemTimestamps({ createdAt, delay, expiry })
  // Only tells who proposed the transaction, so a receipt the RPC doesn't return must not hide it
  const receipt = await provider.getTransactionReceipt(transactionAdded.transactionHash).catch((error) => {
    logError(Errors._615, error)
    return null
  })

  const isMalicious = _isMaliciousRecovery({
    chainId,
    version,
    safeAddress,
    transaction: transactionAdded.args,
  })

  return {
    ...transactionAdded,
    ...timestamps,
    isMalicious,
    executor: receipt?.from,
  }
}

export const _getRecoveryStateItem = async ({
  delayModifier,
  safeAddress,
  provider,
  chainId,
  version,
  explorer,
}: {
  delayModifier: Delay
  safeAddress: string
  provider: JsonRpcProvider
  chainId: string
  version: SafeState['version']
  explorer?: ExplorerApi | null
}): Promise<RecoveryStateItem> => {
  const delayModifierAddress = await delayModifier.getAddress()
  const calls = [
    {
      to: delayModifierAddress,
      data: delayModifier.interface.encodeFunctionData('getModulesPaginated', [
        SENTINEL_ADDRESS,
        MAX_RECOVERER_PAGE_SIZE,
      ]),
    },
    {
      to: delayModifierAddress,
      data: delayModifier.interface.encodeFunctionData('txExpiration'),
    },
    {
      to: delayModifierAddress,
      data: delayModifier.interface.encodeFunctionData('txCooldown'),
    },
    {
      to: delayModifierAddress,
      data: delayModifier.interface.encodeFunctionData('txNonce'),
    },
    {
      to: delayModifierAddress,
      data: delayModifier.interface.encodeFunctionData('queueNonce'),
    },
  ]
  const callResults = await multicall(provider, calls)

  const [[recoverers], expiry, delay, txNonce, queueNonce] = [
    delayModifier.interface.decodeFunctionResult('getModulesPaginated', callResults[0].returnData) as unknown as [
      string[],
      string,
    ],
    BigInt(callResults[1].returnData),
    BigInt(callResults[2].returnData),
    BigInt(callResults[3].returnData),
    BigInt(callResults[4].returnData),
  ]

  const queuedTransactions = await readQueuedTransactions({
    delayModifier,
    delayModifierAddress,
    txNonce,
    queueNonce,
    provider,
  })
  const lookups = await queryAddedTransactions(
    { delayModifier, delayModifierAddress, provider, chainId, explorer },
    queuedTransactions,
  )
  const found = lookups.flatMap(({ transactionAdded, createdAt }) =>
    transactionAdded ? [{ transactionAdded, createdAt }] : [],
  )
  const unavailable = lookups.filter(({ transactionAdded }) => !transactionAdded)

  const queue = await Promise.all(
    found.map(({ transactionAdded, createdAt }) => {
      return getRecoveryQueueItem({
        transactionAdded,
        createdAt,
        delay: BigInt(delay),
        expiry: BigInt(expiry),
        provider,
        chainId,
        version,
        safeAddress,
      })
    }),
  )

  const unavailableQueue = unavailable.map((transaction) =>
    getUnavailableRecoveryQueueItem({
      delayModifierAddress,
      transaction,
      delay: BigInt(delay),
      expiry: BigInt(expiry),
    }),
  )

  return {
    address: await delayModifier.getAddress(),
    recoverers,
    expiry: BigInt(expiry),
    delay: BigInt(delay),
    txNonce: BigInt(txNonce),
    queueNonce: BigInt(queueNonce),
    queue: queue.filter((item) => !item.removed),
    unavailableQueue,
  }
}

export function getRecoveryState({
  delayModifiers,
  ...rest
}: {
  delayModifiers: Array<Delay>
  safeAddress: string
  provider: JsonRpcProvider
  chainId: string
  version: SafeState['version']
  explorer?: ExplorerApi | null
}): Promise<RecoveryState> {
  return Promise.all(delayModifiers.map((delayModifier) => _getRecoveryStateItem({ delayModifier, ...rest })))
}
