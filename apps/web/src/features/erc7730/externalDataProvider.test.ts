import { faker } from '@faker-js/faker'
import type { Balance } from '@safe-global/store/gateway/AUTO_GENERATED/balances'
import type { Chain } from '@safe-global/store/gateway/AUTO_GENERATED/chains'
import { ZERO_ADDRESS } from '@safe-global/protocol-kit/dist/src/utils/constants'
import {
  CLEAR_SIGNING_ETH_PLACEHOLDER,
  createMainnetChainClient,
  isClearSigningNativeTokenAddress,
  resolveClearSigningChainInfo,
  resolveClearSigningToken,
  REVOCATION_CALL_TIMEOUT_MS,
} from './externalDataProvider'

const createMockChain = (chainId: string, overrides?: Partial<Chain>): Chain =>
  ({
    chainId,
    chainName: 'Ethereum',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
      logoUri: '',
    },
    ...overrides,
  }) as Chain

const createBalanceItem = (address: string, symbol: string, decimals: number): Balance =>
  ({
    tokenInfo: {
      type: 'ERC20',
      address,
      name: symbol,
      symbol,
      decimals,
      logoUri: '',
    },
  }) as Balance

describe('externalDataProvider', () => {
  describe('isClearSigningNativeTokenAddress', () => {
    it('returns true for zero address and ETH placeholder', () => {
      expect(isClearSigningNativeTokenAddress(ZERO_ADDRESS)).toBe(true)
      expect(isClearSigningNativeTokenAddress(CLEAR_SIGNING_ETH_PLACEHOLDER)).toBe(true)
      expect(isClearSigningNativeTokenAddress(CLEAR_SIGNING_ETH_PLACEHOLDER.toUpperCase())).toBe(true)
    })

    it('returns false for arbitrary ERC-20 addresses', () => {
      expect(isClearSigningNativeTokenAddress(faker.finance.ethereumAddress())).toBe(false)
    })
  })

  describe('resolveClearSigningChainInfo', () => {
    it('maps chain config to ChainInfoResult', () => {
      const chain = createMockChain('1', { chainName: 'Ethereum Mainnet' })

      expect(resolveClearSigningChainInfo(1, () => chain)).toEqual({
        name: 'Ethereum Mainnet',
        nativeCurrency: {
          name: 'Ether',
          symbol: 'ETH',
          decimals: 18,
        },
      })
    })

    it('returns null when chain is unknown', () => {
      expect(resolveClearSigningChainInfo(999, () => undefined)).toBeNull()
    })
  })

  describe('resolveClearSigningToken', () => {
    const getChain = (id: number) => (id === 1 ? createMockChain('1') : undefined)
    const fetchErc20OnChain = jest.fn()

    beforeEach(() => {
      fetchErc20OnChain.mockReset()
    })

    it('resolves native placeholder from chain config', async () => {
      const result = await resolveClearSigningToken({
        chainId: 1,
        tokenAddress: CLEAR_SIGNING_ETH_PLACEHOLDER,
        currentChainId: '1',
        balanceItems: [],
        getChain,
        fetchErc20OnChain,
      })

      expect(result).toEqual({ name: 'Ether', symbol: 'ETH', decimals: 18 })
      expect(fetchErc20OnChain).not.toHaveBeenCalled()
    })

    it('prefers visible balances over on-chain fetch', async () => {
      const tokenAddress = faker.finance.ethereumAddress()

      const result = await resolveClearSigningToken({
        chainId: 1,
        tokenAddress,
        currentChainId: '1',
        balanceItems: [createBalanceItem(tokenAddress, 'USDC', 6)],
        getChain,
        fetchErc20OnChain,
      })

      expect(result).toEqual({ name: 'USDC', symbol: 'USDC', decimals: 6 })
      expect(fetchErc20OnChain).not.toHaveBeenCalled()
    })

    it('falls back to on-chain ERC-20 metadata on the active chain', async () => {
      const tokenAddress = faker.finance.ethereumAddress()
      fetchErc20OnChain.mockResolvedValue({ symbol: 'UNI', decimals: 18 })

      const result = await resolveClearSigningToken({
        chainId: 1,
        tokenAddress,
        currentChainId: '1',
        balanceItems: [],
        getChain,
        fetchErc20OnChain,
      })

      expect(result).toEqual({ name: 'UNI', symbol: 'UNI', decimals: 18 })
      expect(fetchErc20OnChain).toHaveBeenCalledWith(tokenAddress)
    })

    it('does not fetch on-chain when token chain differs from active chain', async () => {
      const tokenAddress = faker.finance.ethereumAddress()

      const result = await resolveClearSigningToken({
        chainId: 42161,
        tokenAddress,
        currentChainId: '1',
        balanceItems: [],
        getChain: (id) => (id === 42161 ? createMockChain('42161', { chainName: 'Arbitrum One' }) : undefined),
        fetchErc20OnChain,
      })

      expect(result).toBeNull()
      expect(fetchErc20OnChain).not.toHaveBeenCalled()
    })
  })

  describe('createMainnetChainClient', () => {
    const request = { to: faker.finance.ethereumAddress(), data: '0x1234' }
    const result = `0x${'0'.repeat(64)}`
    const configWith = (...chainIds: string[]) => ({
      ids: chainIds,
      entities: Object.fromEntries(chainIds.map((id) => [id, createMockChain(id)])),
    })

    it('performs eth_call on the mainnet chain from the chains config', async () => {
      const config = configWith('1')
      const call = jest.fn().mockResolvedValue(result)
      const createProvider = jest.fn().mockReturnValue({ call })
      const chainClient = createMainnetChainClient(() => config, createProvider)

      await expect(chainClient.call(1, request)).resolves.toBe(result)

      expect(call).toHaveBeenCalledWith(request)
      expect(createProvider).toHaveBeenCalledWith(config.entities['1'])
    })

    it('reuses the provider while the mainnet chain config is unchanged', async () => {
      const config = configWith('1')
      const createProvider = jest.fn().mockReturnValue({ call: jest.fn().mockResolvedValue(result) })
      const chainClient = createMainnetChainClient(() => config, createProvider)

      await chainClient.call(1, request)
      await chainClient.call(1, request)

      expect(createProvider).toHaveBeenCalledTimes(1)
    })

    it.each([
      ['no RPC provider is available for mainnet', configWith('1')],
      ['mainnet is not in the chains config', configWith('100')],
    ])('throws when %s', async (_, config) => {
      const chainClient = createMainnetChainClient(() => config, jest.fn().mockReturnValue(undefined))

      await expect(chainClient.call(1, request)).rejects.toThrow('No RPC provider for Ethereum mainnet')
    })

    it('throws for any chain other than mainnet', async () => {
      const createProvider = jest.fn()
      const chainClient = createMainnetChainClient(() => configWith('1', '11155111'), createProvider)

      await expect(chainClient.call(11155111, request)).rejects.toThrow('mainnet')
      expect(createProvider).not.toHaveBeenCalled()
    })

    it('rejects when the RPC does not answer within the timeout', async () => {
      jest.useFakeTimers()
      const call = jest.fn().mockReturnValue(new Promise<string>(() => {}))
      const chainClient = createMainnetChainClient(() => configWith('1'), jest.fn().mockReturnValue({ call }))

      const pending = expect(chainClient.call(1, request)).rejects.toThrow('ERC-8176 revocation check timed out')
      await jest.advanceTimersByTimeAsync(REVOCATION_CALL_TIMEOUT_MS)

      await pending
      jest.useRealTimers()
    })
  })
})
