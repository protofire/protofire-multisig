import { faker } from '@faker-js/faker'
import type { Balance } from '@safe-global/store/gateway/AUTO_GENERATED/balances'
import type { Chain } from '@safe-global/store/gateway/AUTO_GENERATED/chains'
import { ZERO_ADDRESS } from '@safe-global/protocol-kit/dist/src/utils/constants'
import {
  CLEAR_SIGNING_ETH_PLACEHOLDER,
  isClearSigningNativeTokenAddress,
  resolveClearSigningChainInfo,
  resolveClearSigningToken,
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
})
