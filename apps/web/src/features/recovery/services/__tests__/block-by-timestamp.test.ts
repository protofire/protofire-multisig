import type { Block, JsonRpcProvider } from 'ethers'

import { createBlockTimestampReader, findBlockWindowForTimestamp, type BlockRange } from '../block-by-timestamp'

type Chain = (blockNumber: number) => number

const oneBlockPerSecond: Chain = (n) => 1_000 + n
const threeBlocksPerSecond: Chain = (n) => 1_000 + Math.floor(n / 3)
// 12s blocks for the first 5M blocks, then 2s blocks
const blockTimeChange: Chain = (n) => (n < 5_000_000 ? 1_000 + n * 12 : 60_001_000 + (n - 5_000_000) * 2)

// Public RPCs cap eth_getLogs at 2,000 blocks
const MAX_LOGS_RANGE = 2_000

const readerFor = (chain: Chain) => jest.fn((blockNumber: number) => Promise.resolve(chain(blockNumber)))

// An RPC that doesn't return any block below `earliestAvailable`, failing with `message`
const prunedReaderFor = (chain: Chain, earliestAvailable: number, message = 'missing') =>
  jest.fn((blockNumber: number) =>
    blockNumber < earliestAvailable ? Promise.reject(new Error(message)) : Promise.resolve(chain(blockNumber)),
  )

// Every block mined at `timestamp` must be inside the window, and the window must fit one eth_getLogs
const expectWindowCovers = (chain: Chain, latest: number, timestamp: number, window: BlockRange | null) => {
  expect(window).not.toBeNull()
  const { fromBlock, toBlock } = window!

  expect(toBlock - fromBlock).toBeLessThan(MAX_LOGS_RANGE)
  expect(fromBlock === 0 || chain(fromBlock - 1) < timestamp || chain(fromBlock) < timestamp).toBe(true)
  expect(toBlock === latest || chain(toBlock + 1) > timestamp || chain(toBlock) > timestamp).toBe(true)
  expect(chain(fromBlock)).toBeLessThanOrEqual(timestamp)
  expect(chain(toBlock)).toBeGreaterThanOrEqual(timestamp)
}

describe('block-by-timestamp', () => {
  describe('findBlockWindowForTimestamp', () => {
    it.each([
      ['1 block/s', 0, oneBlockPerSecond, 10_000_000],
      ['1 block/s', 420, oneBlockPerSecond, 10_000_000],
      ['1 block/s', 4_999_999, oneBlockPerSecond, 10_000_000],
      ['1 block/s', 9_999_500, oneBlockPerSecond, 10_000_000],
      ['3 blocks/s', 7, threeBlocksPerSecond, 300_000_000],
      ['3 blocks/s', 123_456, threeBlocksPerSecond, 300_000_000],
      ['3 blocks/s', 299_123_456, threeBlocksPerSecond, 300_000_000],
      ['block time change', 4_999_999, blockTimeChange, 10_000_000],
      ['block time change', 5_000_001, blockTimeChange, 10_000_000],
    ])('covers every block mined in the same second (%s, block %i)', async (_, target, chain, latest) => {
      const timestamp = chain(target)

      const window = await findBlockWindowForTimestamp({
        timestamp,
        latestBlock: latest,
        getTimestamp: readerFor(chain),
      })

      expectWindowCovers(chain, latest, timestamp, window)
    })

    it('needs few block headers on a regular chain', async () => {
      const getTimestamp = readerFor(threeBlocksPerSecond)

      await findBlockWindowForTimestamp({
        timestamp: threeBlocksPerSecond(299_123_456),
        latestBlock: 300_000_000,
        getTimestamp,
      })

      expect(getTimestamp.mock.calls.length).toBeLessThanOrEqual(15)
    })

    it('stays within budget when the block time changed mid-history', async () => {
      const getTimestamp = readerFor(blockTimeChange)

      await findBlockWindowForTimestamp({
        timestamp: blockTimeChange(4_999_999),
        latestBlock: 10_000_000,
        getTimestamp,
      })

      expect(getTimestamp.mock.calls.length).toBeLessThanOrEqual(40)
    })

    it('includes the latest block when the transaction is in the latest second', async () => {
      const latest = 299_999_999
      const timestamp = threeBlocksPerSecond(latest)

      const window = await findBlockWindowForTimestamp({
        timestamp,
        latestBlock: latest,
        getTimestamp: readerFor(threeBlocksPerSecond),
      })

      expectWindowCovers(threeBlocksPerSecond, latest, timestamp, window)
      expect(window?.toBlock).toBe(latest)
    })

    it('covers the whole second when stepping back stops on a block mined in it', async () => {
      // Stepping back 1,000 blocks from the latest block lands on the first of the 3 blocks of the second
      const latest = 2_998
      const timestamp = threeBlocksPerSecond(latest - 1_000)

      const window = await findBlockWindowForTimestamp({
        timestamp,
        latestBlock: latest,
        getTimestamp: readerFor(threeBlocksPerSecond),
      })

      expectWindowCovers(threeBlocksPerSecond, latest, timestamp, window)
    })

    it('returns null when the timestamp is newer than the latest block', async () => {
      const window = await findBlockWindowForTimestamp({
        timestamp: oneBlockPerSecond(100) + 5,
        latestBlock: 100,
        getTimestamp: readerFor(oneBlockPerSecond),
      })

      expect(window).toBeNull()
    })

    it('does not read blocks far older than the target (pruned history)', async () => {
      const getTimestamp = prunedReaderFor(threeBlocksPerSecond, 290_000_000)
      const timestamp = threeBlocksPerSecond(295_000_000)

      const window = await findBlockWindowForTimestamp({ timestamp, latestBlock: 300_000_000, getTimestamp })

      expectWindowCovers(threeBlocksPerSecond, 300_000_000, timestamp, window)
    })

    it('still finds the timestamp when a fast recent block time steps into pruned history', async () => {
      const switchBlock = 5_000_000
      const slowThenFast = (n: number) =>
        n < switchBlock ? 1_000 + n * 12 : 1_000 + switchBlock * 12 + Math.floor((n - switchBlock) / 4)
      const latest = switchBlock + 4 * 14 * 24 * 60 * 60
      const timestamp = slowThenFast(switchBlock + 100_000)

      const window = await findBlockWindowForTimestamp({
        timestamp,
        latestBlock: latest,
        getTimestamp: prunedReaderFor(slowThenFast, switchBlock),
      })

      expectWindowCovers(slowThenFast, latest, timestamp, window)
    })

    it('finds the timestamp right above pruned history', async () => {
      const getTimestamp = prunedReaderFor(threeBlocksPerSecond, 290_000_000)
      const timestamp = threeBlocksPerSecond(290_000_003)

      const window = await findBlockWindowForTimestamp({ timestamp, latestBlock: 300_000_000, getTimestamp })

      expectWindowCovers(threeBlocksPerSecond, 300_000_000, timestamp, window)
    })

    it('throws when that second exists only in pruned history', async () => {
      const getTimestamp = prunedReaderFor(oneBlockPerSecond, 1_000_000)

      await expect(
        findBlockWindowForTimestamp({ timestamp: 1_010, latestBlock: 2_000_000, getTimestamp }),
      ).rejects.toThrow("Blocks at 1010 can't be read, the first block returned is 1000000")
    })

    it('stops after finding the first block the RPC returns when the target is older', async () => {
      const getTimestamp = prunedReaderFor(threeBlocksPerSecond, 290_000_000)

      await expect(
        findBlockWindowForTimestamp({
          timestamp: threeBlocksPerSecond(200_000_000),
          latestBlock: 300_000_000,
          getTimestamp,
        }),
      ).rejects.toThrow("can't be read")
      expect(getTimestamp.mock.calls.length).toBeLessThanOrEqual(35)
    })

    it.each(['rate limit: server busy', 'requested height has been pruned', 'any other answer'])(
      'treats a block the RPC does not return as unreadable, whatever the error (%s)',
      async (message) => {
        const getTimestamp = prunedReaderFor(threeBlocksPerSecond, 290_000_000, message)
        const timestamp = threeBlocksPerSecond(295_000_000)

        const window = await findBlockWindowForTimestamp({ timestamp, latestBlock: 300_000_000, getTimestamp })

        expectWindowCovers(threeBlocksPerSecond, 300_000_000, timestamp, window)
      },
    )

    it('stops after 100 block reads when an RPC returns inconsistent timestamps', async () => {
      // Every block but the latest reports the searched second, so each step back moves by two blocks
      const getTimestamp = jest.fn((blockNumber: number) =>
        Promise.resolve(blockNumber === 300_000_000 ? 2_000_000_000 : 1_000),
      )

      await expect(
        findBlockWindowForTimestamp({ timestamp: 1_000, latestBlock: 300_000_000, getTimestamp }),
      ).rejects.toThrow()
      expect(getTimestamp.mock.calls.length).toBeLessThanOrEqual(100)
    })
  })

  describe('createBlockTimestampReader', () => {
    it('caches block timestamps', async () => {
      const getBlock = jest.fn((n: number) => Promise.resolve({ number: n, timestamp: 1_000 + n } as Block))
      const getTimestamp = createBlockTimestampReader({ getBlock } as unknown as JsonRpcProvider)

      await expect(getTimestamp(5)).resolves.toBe(1_005)
      await expect(getTimestamp(5)).resolves.toBe(1_005)
      expect(getBlock).toHaveBeenCalledTimes(1)
    })

    it('throws when the block is not available', async () => {
      const getBlock = jest.fn(() => Promise.resolve(null))
      const getTimestamp = createBlockTimestampReader({ getBlock } as unknown as JsonRpcProvider)

      await expect(getTimestamp(5)).rejects.toThrow('Block 5 not available')
    })

    it('retries a block read after a transient failure', async () => {
      const getBlock = jest
        .fn()
        .mockRejectedValueOnce(new Error('temporary'))
        .mockResolvedValueOnce({ number: 5, timestamp: 1_005 } as Block)
      const getTimestamp = createBlockTimestampReader({ getBlock } as unknown as JsonRpcProvider)

      await expect(getTimestamp(5)).rejects.toThrow('temporary')
      await expect(getTimestamp(5)).resolves.toBe(1_005)
      expect(getBlock).toHaveBeenCalledTimes(2)
    })
  })
})
