import type { JsonRpcProvider } from 'ethers'

export type GetBlockTimestamp = (blockNumber: number) => Promise<number>

export type BlockRange = { fromBlock: number; toBlock: number }

type BlockPoint = { block: number; timestamp: number }

// Blocks used to measure the recent block time before stepping back from the latest block
const BLOCK_TIME_SAMPLE = 1_000
// Step slightly further than estimated so that a single step usually lands before the target
const STEP_BACK_MARGIN = 1.1
// Public RPCs cap eth_getLogs at 2,000 blocks
const MAX_WINDOW_BLOCKS = 1_000
// A search reads about 5-30 block headers. Far more means the RPC misbehaves, so stop instead of flooding it
const MAX_BLOCK_READS = 100

const limitReads = (getTimestamp: GetBlockTimestamp): GetBlockTimestamp => {
  let reads = 0

  return (blockNumber) => {
    reads += 1
    if (reads > MAX_BLOCK_READS) {
      return Promise.reject(new Error(`Block search exceeded ${MAX_BLOCK_READS} block reads`))
    }
    return getTimestamp(blockNumber)
  }
}

const readPoint = async (block: number, getTimestamp: GetBlockTimestamp): Promise<BlockPoint> => ({
  block,
  timestamp: await getTimestamp(block),
})

// Null when the RPC doesn't return the block, whatever the reason
const tryReadPoint = async (block: number, getTimestamp: GetBlockTimestamp): Promise<BlockPoint | null> => {
  try {
    return await readPoint(block, getTimestamp)
  } catch {
    return null
  }
}

/**
 * Binary search for the first block the RPC returns between one it didn't return and one it did.
 * RPCs drop old history from genesis up, so the blocks they still serve start somewhere in between.
 */
const findFirstReadable = async (
  unreadable: number,
  readable: BlockPoint,
  getTimestamp: GetBlockTimestamp,
): Promise<BlockPoint> => {
  let low = unreadable
  let high = readable

  while (high.block - low > 1) {
    const pivot = low + Math.floor((high.block - low) / 2)
    const point = await tryReadPoint(pivot, getTimestamp)

    if (point) {
      high = point
    } else {
      low = pivot
    }
  }

  return high
}

/**
 * Reads `block` or, if the RPC doesn't return it, the first block it returns below `upper`.
 * Throws when even that block is not older than `timestamp`: the blocks mined at it can't be read.
 */
const readPointOrFirstReadable = async (
  block: number,
  upper: BlockPoint,
  timestamp: number,
  getTimestamp: GetBlockTimestamp,
): Promise<BlockPoint> => {
  const point = await tryReadPoint(block, getTimestamp)
  if (point) return point

  const firstReadable = await findFirstReadable(block, upper, getTimestamp)
  if (firstReadable.timestamp >= timestamp) {
    throw new Error(`Blocks at ${timestamp} can't be read, the first block returned is ${firstReadable.block}`)
  }
  return firstReadable
}

const estimateStepBack = (point: BlockPoint, latest: BlockPoint, timestamp: number): number => {
  const blocksPerSecond = (latest.block - point.block) / Math.max(1, latest.timestamp - point.timestamp)
  return Math.ceil((point.timestamp - timestamp + 1) * blocksPerSecond * STEP_BACK_MARGIN) + 1
}

/**
 * Steps back from the latest block by the measured block time until a block older than `timestamp`
 * is found. Only blocks around and after the target are read, so it works on RPCs that prune history.
 */
const stepBackBelow = async (
  timestamp: number,
  latest: BlockPoint,
  getTimestamp: GetBlockTimestamp,
): Promise<{ lower: BlockPoint; upper: BlockPoint }> => {
  let upper = latest
  let lower = await readPointOrFirstReadable(
    Math.max(0, latest.block - BLOCK_TIME_SAMPLE),
    upper,
    timestamp,
    getTimestamp,
  )

  while (lower.timestamp >= timestamp && lower.block > 0) {
    const block = Math.max(0, lower.block - estimateStepBack(lower, latest, timestamp))
    upper = lower
    lower = await readPointOrFirstReadable(block, upper, timestamp, getTimestamp)
  }

  return { lower, upper }
}

const interpolateBlock = (lower: BlockPoint, upper: BlockPoint, timestamp: number): number => {
  const seconds = upper.timestamp - lower.timestamp
  const guess =
    seconds > 0
      ? lower.block + Math.round(((timestamp - lower.timestamp) / seconds) * (upper.block - lower.block))
      : lower.block + Math.floor((upper.block - lower.block) / 2)
  return Math.min(upper.block - 1, Math.max(lower.block + 1, guess))
}

// Blocks mined in the same second are adjacent and few, so gallop away from one until another second
const gallopPast = async (
  point: BlockPoint,
  bound: BlockPoint,
  direction: -1 | 1,
  getTimestamp: GetBlockTimestamp,
): Promise<BlockPoint> => {
  for (let step = 1; ; step *= 2) {
    const block = point.block + direction * step
    if (direction === -1 ? block <= bound.block : block >= bound.block) return bound

    const next = await readPoint(block, getTimestamp)
    if (next.timestamp !== point.timestamp) return next
  }
}

/**
 * Narrows a bracket around `timestamp` until it fits a single eth_getLogs.
 * Keeps `lower` older and `upper` newer than `timestamp` (or the latest block), so every block mined
 * at it stays inside: block timestamps never decrease.
 */
const narrowBracket = async (
  timestamp: number,
  bracket: { lower: BlockPoint; upper: BlockPoint },
  latest: BlockPoint,
  getTimestamp: GetBlockTimestamp,
): Promise<BlockRange> => {
  let { lower } = bracket
  // Stepping back can stop on a block mined at `timestamp`; later blocks of that second must stay inside
  let upper =
    bracket.upper.timestamp === timestamp ? await gallopPast(bracket.upper, latest, 1, getTimestamp) : bracket.upper
  let bisect = false

  while (upper.block - lower.block > MAX_WINDOW_BLOCKS) {
    const span = upper.block - lower.block
    const block = bisect ? lower.block + Math.floor(span / 2) : interpolateBlock(lower, upper, timestamp)
    const point = await readPoint(block, getTimestamp)

    if (point.timestamp === timestamp) {
      const [before, after] = await Promise.all([
        gallopPast(point, lower, -1, getTimestamp),
        gallopPast(point, upper, 1, getTimestamp),
      ])
      return { fromBlock: before.block, toBlock: after.block }
    }

    if (point.timestamp < timestamp) {
      lower = point
    } else {
      upper = point
    }

    // Bisect next when interpolation didn't halve the bracket, so the search stays logarithmic
    bisect = !bisect && upper.block - lower.block > span / 2
  }

  return { fromBlock: lower.block, toBlock: upper.block }
}

/**
 * A range of at most a few thousand blocks containing every block mined at `timestamp`, small enough
 * for one eth_getLogs. Null if the latest block is older than `timestamp`.
 * Throws when those blocks can't be read from the RPC, e.g. because it no longer serves that history.
 */
export const findBlockWindowForTimestamp = async ({
  timestamp,
  latestBlock,
  getTimestamp,
}: {
  timestamp: number
  latestBlock: number
  getTimestamp: GetBlockTimestamp
}): Promise<BlockRange | null> => {
  const read = limitReads(getTimestamp)

  const latest = await readPoint(latestBlock, read)
  if (latest.timestamp < timestamp) return null

  const bracket = await stepBackBelow(timestamp, latest, read)
  return narrowBracket(timestamp, bracket, latest, read)
}

export const createBlockTimestampReader = (provider: JsonRpcProvider): GetBlockTimestamp => {
  const cache = new Map<number, Promise<number>>()

  return (blockNumber) => {
    const cached = cache.get(blockNumber)
    if (cached) return cached

    const timestamp = provider.getBlock(blockNumber).then((block) => {
      if (!block) throw new Error(`Block ${blockNumber} not available`)
      return block.timestamp
    })
    cache.set(blockNumber, timestamp)
    // A rejected read must not stick: the same header is reused across queued nonces, and a
    // rate-limit on the first one would otherwise fail the rest of the search.
    timestamp.catch(() => {
      if (cache.get(blockNumber) === timestamp) cache.delete(blockNumber)
    })
    return timestamp
  }
}
