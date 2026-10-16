import {
  createPortfolioBalances,
  transformPortfolioToBalances,
  calculateTokensFiatTotal,
  initialBalancesState,
} from '@safe-global/utils/hooks/portfolioBalances'
import type { Balances } from '@safe-global/store/gateway/AUTO_GENERATED/balances'
import type { Portfolio } from '@safe-global/store/gateway/AUTO_GENERATED/portfolios'

describe('portfolioBalances helpers', () => {
  describe('initialBalancesState', () => {
    it('should have empty items and fiatTotal', () => {
      expect(initialBalancesState.items).toEqual([])
      expect(initialBalancesState.fiatTotal).toBe('')
    })
  })

  describe('createPortfolioBalances', () => {
    it('should wrap tx service balances with portfolio fields', () => {
      const balances: Balances = {
        fiatTotal: '1000',
        items: [
          {
            balance: '1',
            fiatBalance: '1000',
            fiatConversion: '1000',
            tokenInfo: {
              address: '0x1',
              decimals: 18,
              logoUri: '',
              name: 'Token',
              symbol: 'TKN',
              type: 'ERC20',
            },
          },
        ],
      }

      const result = createPortfolioBalances(balances)

      expect(result.fiatTotal).toBe('1000')
      expect(result.tokensFiatTotal).toBe('1000')
      expect(result.positionsFiatTotal).toBe('0')
      expect(result.positions).toBeUndefined()
      expect(result.items).toEqual(balances.items)
    })
  })

  describe('transformPortfolioToBalances', () => {
    it('should return undefined for undefined portfolio', () => {
      expect(transformPortfolioToBalances(undefined)).toBeUndefined()
    })

    const portfolio: Portfolio = {
      totalBalanceFiat: '3000',
      totalTokenBalanceFiat: '2000',
      totalPositionsBalanceFiat: '1000',
      tokenBalances: [
        {
          tokenInfo: {
            address: '0x1',
            decimals: 18,
            logoUri: 'https://example.com/logo.png',
            name: 'Token',
            symbol: 'TKN',
            type: 'ERC20' as const,
            chainId: '1',
            trusted: true,
          },
          balance: '1000',
          balanceFiat: '2000',
          price: '2',
          priceChangePercentage1d: '0.05',
        },
      ],
      positionBalances: [],
    }

    it('should transform fiat totals correctly', () => {
      const result = transformPortfolioToBalances(portfolio)

      expect(result?.fiatTotal).toBe('3000')
      expect(result?.tokensFiatTotal).toBe('2000')
      expect(result?.positionsFiatTotal).toBe('1000')
    })

    it('should transform token items correctly', () => {
      const result = transformPortfolioToBalances(portfolio)

      expect(result?.items).toHaveLength(1)
      expect(result?.items[0]?.fiatBalance).toBe('2000')
      expect(result?.items[0]?.fiatConversion).toBe('2')
    })

    it('should transform positions correctly', () => {
      const result = transformPortfolioToBalances(portfolio)

      expect(result?.positions).toEqual([])
    })

    it('should handle price change data', () => {
      const result = transformPortfolioToBalances(portfolio)

      expect(result?.items[0]?.fiatBalance24hChange).toBe('0.05')
    })

    it('should default logoUri to empty string when missing', () => {
      const portfolio: Portfolio = {
        totalBalanceFiat: '0',
        totalTokenBalanceFiat: '0',
        totalPositionsBalanceFiat: '0',
        tokenBalances: [
          {
            tokenInfo: {
              address: '0x1',
              decimals: 18,
              logoUri: '',
              name: 'Token',
              symbol: 'TKN',
              type: 'ERC20' as const,
              chainId: '1',
              trusted: true,
            },
            balance: '0',
            balanceFiat: '0',
            price: '0',
            priceChangePercentage1d: '0',
          },
        ],
        positionBalances: [],
      }

      const result = transformPortfolioToBalances(portfolio)

      expect(result?.items[0]?.tokenInfo.logoUri).toBe('')
    })

    describe('native currency normalization', () => {
      // Mirrors Celo: the native gas currency is also a real ERC-20 contract, so
      // providers like Zerion report it at its contract address instead of the
      // app's zero-address NATIVE_TOKEN sentinel.
      const misreportedNativePortfolio: Portfolio = {
        totalBalanceFiat: '100',
        totalTokenBalanceFiat: '100',
        totalPositionsBalanceFiat: '0',
        tokenBalances: [
          {
            tokenInfo: {
              address: '0x471EcE3750Da237f93B8E339c536989b8978a438',
              decimals: 18,
              logoUri: '',
              name: 'Celo',
              symbol: 'celo',
              type: 'ERC20' as const,
              chainId: '42220',
              trusted: true,
            },
            balance: '80000000000000000',
            balanceFiat: '100',
            price: '1',
            priceChangePercentage1d: '0',
          },
        ],
        positionBalances: [],
      }

      it('normalizes an ERC-20-reported entry matching the chain native currency to the NATIVE_TOKEN sentinel', () => {
        const result = transformPortfolioToBalances(misreportedNativePortfolio, { symbol: 'CELO', decimals: 18 })

        expect(result?.items).toHaveLength(1)
        expect(result?.items[0]?.tokenInfo.type).toBe('NATIVE_TOKEN')
        expect(result?.items[0]?.tokenInfo.address).toBe('0x0000000000000000000000000000000000000000')
        // Non-address/type fields (symbol, name, balance) are preserved
        expect(result?.items[0]?.tokenInfo.symbol).toBe('celo')
        expect(result?.items[0]?.balance).toBe('80000000000000000')
      })

      it('matches the native currency symbol case-insensitively', () => {
        const result = transformPortfolioToBalances(misreportedNativePortfolio, { symbol: 'Celo', decimals: 18 })

        expect(result?.items[0]?.tokenInfo.type).toBe('NATIVE_TOKEN')
      })

      it('does not normalize when nativeCurrency is not provided', () => {
        const result = transformPortfolioToBalances(misreportedNativePortfolio)

        expect(result?.items[0]?.tokenInfo.type).toBe('ERC20')
        expect(result?.items[0]?.tokenInfo.address).toBe('0x471EcE3750Da237f93B8E339c536989b8978a438')
      })

      it('does not normalize a token whose symbol matches but decimals differ', () => {
        const result = transformPortfolioToBalances(misreportedNativePortfolio, { symbol: 'CELO', decimals: 6 })

        expect(result?.items[0]?.tokenInfo.type).toBe('ERC20')
      })

      it('does not normalize a token whose decimals match but symbol differs', () => {
        const result = transformPortfolioToBalances(misreportedNativePortfolio, { symbol: 'ETH', decimals: 18 })

        expect(result?.items[0]?.tokenInfo.type).toBe('ERC20')
      })

      it('leaves items untouched when a NATIVE_TOKEN entry is already present', () => {
        const portfolioWithNativeEntry: Portfolio = {
          ...misreportedNativePortfolio,
          tokenBalances: [
            ...misreportedNativePortfolio.tokenBalances,
            {
              tokenInfo: {
                address: '0x0000000000000000000000000000000000000000',
                decimals: 18,
                logoUri: '',
                name: 'Celo',
                symbol: 'CELO',
                type: 'NATIVE_TOKEN' as const,
                chainId: '42220',
                trusted: true,
              },
              balance: '80000000000000000',
              balanceFiat: '100',
              price: '1',
              priceChangePercentage1d: '0',
            },
          ],
        }

        const result = transformPortfolioToBalances(portfolioWithNativeEntry, { symbol: 'CELO', decimals: 18 })

        expect(result?.items).toHaveLength(2)
        expect(result?.items[0]?.tokenInfo.type).toBe('ERC20')
        expect(result?.items[1]?.tokenInfo.type).toBe('NATIVE_TOKEN')
      })
    })
  })

  describe('calculateTokensFiatTotal', () => {
    it('should sum fiat balances from items', () => {
      const items: Balances['items'] = [
        {
          balance: '1',
          fiatBalance: '100',
          fiatConversion: '100',
          tokenInfo: { address: '0x1', decimals: 18, logoUri: '', name: 'A', symbol: 'A', type: 'ERC20' },
        },
        {
          balance: '1',
          fiatBalance: '200.5',
          fiatConversion: '200.5',
          tokenInfo: { address: '0x2', decimals: 18, logoUri: '', name: 'B', symbol: 'B', type: 'ERC20' },
        },
      ]

      expect(calculateTokensFiatTotal(items)).toBe('300.5')
    })

    it('should return 0 for empty items', () => {
      expect(calculateTokensFiatTotal([])).toBe('0')
    })

    it('should handle missing fiatBalance', () => {
      const items: Balances['items'] = [
        {
          balance: '1',
          fiatBalance: '',
          fiatConversion: '0',
          tokenInfo: { address: '0x1', decimals: 18, logoUri: '', name: 'A', symbol: 'A', type: 'ERC20' },
        },
      ]

      expect(calculateTokensFiatTotal(items)).toBe('0')
    })
  })
})
