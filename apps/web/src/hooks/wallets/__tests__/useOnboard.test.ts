import { faker } from '@faker-js/faker'
import type { EIP1193Provider, OnboardAPI, WalletState } from '@web3-onboard/core'
import type { Chain } from '@safe-global/store/gateway/AUTO_GENERATED/chains'
import { getConnectedWallet, switchWallet, trackWalletType, useInitOnboard, useIsWalletReady } from '../useOnboard'
import { trackEvent } from '@/services/analytics'
import { renderHook, waitFor } from '@/tests/test-utils'
import * as useChainsHook from '@/hooks/useChains'
import * as store from '@/store'
import { chainBuilder } from '@/tests/builders/chains'
import * as onboardService from '@/services/onboard'
import * as chainIdHooks from '@/hooks/useChainId'

// mock wallets
jest.mock('@/hooks/wallets/wallets', () => ({
  getDefaultWallets: jest.fn(() => []),
  getSupportedWallets: jest.fn(() => []),
  getAllWallets: jest.fn(() => []),
}))

// mock last-wallet storage so useInitOnboard's silent reconnect has something to reconnect to
jest.mock('@/services/local-storage/local', () => ({
  __esModule: true,
  default: { getItem: jest.fn(() => null), setItem: jest.fn(), removeItem: jest.fn() },
  localItem: jest.fn(() => ({
    get: jest.fn(() => 'MetaMask'),
    set: jest.fn(),
    remove: jest.fn(),
  })),
}))

// mock wallet-unlock check so connectLastWallet proceeds
jest.mock('@/utils/wallets', () => ({
  ...(jest.requireActual('@/utils/wallets') as object),
  isWalletUnlocked: jest.fn().mockResolvedValue(true),
}))

// mock analytics - using jest.requireActual to avoid hoisting issues
jest.mock('@/services/analytics', () => ({
  ...(
    jest.requireActual('@safe-global/test/mocks/analytics') as { createAnalyticsMock: () => object }
  ).createAnalyticsMock(),
  WALLET_EVENTS: {
    CONNECT: { action: 'connect_wallet' },
    WALLET_CONNECT: { action: 'wallet_connect' },
  },
  MixpanelEventParams: {
    EOA_WALLET_LABEL: 'EOA Wallet Label',
    EOA_WALLET_ADDRESS: 'EOA Wallet Address',
    EOA_WALLET_NETWORK: 'EOA Wallet Network',
  },
}))

describe('useOnboard', () => {
  describe('getConnectedWallet', () => {
    it('returns the connected wallet', () => {
      const wallets = [
        {
          label: 'Wallet 1',
          icon: 'wallet1.svg',
          provider: null as unknown as EIP1193Provider,
          chains: [{ id: '0x4', namespace: 'evm' }],
          accounts: [
            {
              address: '0x1234567890123456789012345678901234567890',
              ens: {
                name: 'test.eth',
              },
              uns: null,
              balance: {
                ETH: '0.002346456767547',
              },
            },
          ],
        },
        {
          label: 'Wallet 2',
          icon: 'wallet2.svg',
          provider: null as unknown as EIP1193Provider,
          chains: [{ id: '0x100', namespace: 'evm' }],
          accounts: [
            {
              address: '0x2',
              ens: null,
              uns: null,
              balance: null,
            },
          ],
        },
      ] as unknown as WalletState[]

      expect(getConnectedWallet(wallets)).toEqual({
        label: 'Wallet 1',
        icon: 'wallet1.svg',
        address: '0x1234567890123456789012345678901234567890',
        provider: wallets[0].provider,
        chainId: '4',
        ens: 'test.eth',
        balance: '0.00235 ETH',
        isProposer: false,
      })
    })

    it('should return null if the address is invalid', () => {
      const wallets = [
        {
          label: 'Wallet 1',
          icon: 'wallet1.svg',
          provider: null as unknown as EIP1193Provider,
          chains: [{ id: '0x4', namespace: 'evm' }],
          accounts: [
            {
              address: '0xinvalid',
              ens: null,
              uns: null,
              balance: null,
            },
          ],
        },
      ] as unknown as WalletState[]

      expect(getConnectedWallet(wallets)).toBeNull()
    })
  })

  describe('switchWallet', () => {
    it('should not disconnect the wallet if new wallet connects', async () => {
      const mockNewState = [
        {
          accounts: [
            {
              address: faker.finance.ethereumAddress(),
              ens: undefined,
            },
          ],
          chains: [
            {
              id: '5',
            },
          ],
          label: 'MetaMask',
        },
      ]

      const mockOnboard = {
        state: {
          get: jest.fn().mockReturnValue({
            wallets: [
              {
                accounts: [
                  {
                    address: faker.finance.ethereumAddress(),
                    ens: undefined,
                  },
                ],
                chains: [
                  {
                    id: '5',
                  },
                ],
                label: 'Wallet Connect',
              },
            ],
          }),
        },
        connectWallet: jest.fn().mockResolvedValue(mockNewState),
        disconnectWallet: jest.fn(),
      }

      await switchWallet(mockOnboard as unknown as OnboardAPI)

      expect(mockOnboard.connectWallet).toBeCalled()
      expect(mockOnboard.disconnectWallet).not.toHaveBeenCalled()
    })
  })

  describe('trackWalletType', () => {
    beforeEach(() => {
      ;(trackEvent as jest.Mock).mockClear()
    })

    it('should track wallet connection with proper Mixpanel parameters', () => {
      const wallet = {
        label: 'MetaMask',
        chainId: '1',
        address: '0x1234567890123456789012345678901234567890',
        provider: {} as any,
      }

      const configs = [
        {
          chainId: '1',
          chainName: 'Ethereum',
        },
      ] as Chain[]

      trackWalletType(wallet, configs)

      expect(trackEvent).toHaveBeenCalledWith(
        { action: 'connect_wallet', label: 'MetaMask' },
        {
          'EOA Wallet Label': 'MetaMask',
          'EOA Wallet Address': '0x1234567890123456789012345678901234567890',
          'EOA Wallet Network': 'Ethereum',
        },
      )
    })

    it('should use fallback network name when chain not found', () => {
      const wallet = {
        label: 'MetaMask',
        chainId: '999',
        address: '0x1234567890123456789012345678901234567890',
        provider: {} as any,
      }

      const configs = [
        {
          chainId: '1',
          chainName: 'Ethereum',
        },
      ] as Chain[]

      trackWalletType(wallet, configs)

      expect(trackEvent).toHaveBeenCalledWith(
        { action: 'connect_wallet', label: 'MetaMask' },
        {
          'EOA Wallet Label': 'MetaMask',
          'EOA Wallet Address': '0x1234567890123456789012345678901234567890',
          'EOA Wallet Network': 'Chain 999',
        },
      )
    })

    it('should track additional WalletConnect event for WC wallets', () => {
      const wallet = {
        label: 'WalletConnect',
        chainId: '1',
        address: '0x1234567890123456789012345678901234567890',
        provider: {
          connector: {
            session: {
              peer: {
                metadata: {
                  name: 'Trust Wallet',
                },
              },
            },
          },
        } as any,
      }

      const configs = [
        {
          chainId: '1',
          chainName: 'Ethereum',
        },
      ] as Chain[]

      trackWalletType(wallet, configs)

      expect(trackEvent).toHaveBeenCalledTimes(2)
      expect(trackEvent).toHaveBeenNthCalledWith(2, {
        action: 'wallet_connect',
        label: 'Trust Wallet',
      })
    })
  })

  describe('useInitOnboard', () => {
    const mockChain = chainBuilder().with({ chainId: '1' }).build()

    const mockOnboardApi = {
      state: {
        select: jest.fn(() => ({ subscribe: jest.fn(() => ({ unsubscribe: jest.fn() })) })),
        actions: { setWalletModules: jest.fn() },
        get: jest.fn(() => ({ wallets: [] })),
      },
      connectWallet: jest.fn().mockResolvedValue([]),
    } as unknown as OnboardAPI

    beforeEach(() => {
      jest.clearAllMocks()
      jest.spyOn(onboardService, 'createOnboard').mockReturnValue(mockOnboardApi)
      jest.spyOn(store, 'useAppSelector').mockReturnValue(undefined)
      jest.spyOn(store, 'useAppDispatch').mockReturnValue(jest.fn())
    })

    // `useOnboard`'s internal ExternalStore is a module-level singleton shared by every test in
    // this file (initOnboard only calls createOnboard once and reuses that instance after), so
    // this single test drives isRuntimeData through both states on the one onboard instance
    // rather than trying to get a fresh mock per test.
    it('inits onboard and the wallet module list immediately, but only silently reconnects once runtime chains data has arrived', async () => {
      // createOnboard/setWalletModules must not be gated on isRuntimeData — the chains fetch
      // retries for up to ~2 min on a CGW blip, and the picker/module list re-run anyway once
      // configs updates to the runtime data, so there's no reason to leave the "Connect wallet"
      // button dead for that whole window.
      // Same configs array reference throughout: if isRuntimeData were dropped from the effect's
      // deps, a `configs` swap would be the only thing left to trigger the second setWalletModules
      // call — keeping the same reference forces the assertion through isRuntimeData actually
      // being in the deps array.
      const configs = [mockChain]
      jest.spyOn(useChainsHook, 'default').mockReturnValue({
        configs,
        loading: false,
        isRuntimeData: false,
      })
      jest.spyOn(useChainsHook, 'useCurrentChain').mockReturnValue(mockChain)

      const { result, rerender } = renderHook(() => {
        useInitOnboard()
        return useIsWalletReady()
      })

      await waitFor(() => {
        expect(onboardService.createOnboard).toHaveBeenCalled()
      })
      await waitFor(() => {
        expect(mockOnboardApi.state.actions.setWalletModules).toHaveBeenCalledTimes(1)
      })
      // Give the enableWallets().then(...) chain a chance to run before asserting the negatives
      await new Promise((resolve) => setTimeout(resolve, 0))
      expect(mockOnboardApi.connectWallet).not.toHaveBeenCalled()
      expect(result.current).not.toBe(true)

      // Runtime chains fetch settles — same configs reference, only isRuntimeData flips
      jest.spyOn(useChainsHook, 'default').mockReturnValue({
        configs,
        loading: false,
        isRuntimeData: true,
      })
      rerender()

      await waitFor(() => {
        expect(mockOnboardApi.state.actions.setWalletModules).toHaveBeenCalledTimes(2)
      })
      await waitFor(() => {
        expect(mockOnboardApi.connectWallet).toHaveBeenCalledTimes(1)
      })
      expect(mockOnboardApi.connectWallet).toHaveBeenCalledWith(
        expect.objectContaining({ autoSelect: expect.objectContaining({ label: 'MetaMask' }) }),
      )
      await waitFor(() => {
        expect(result.current).toBe(true)
      })

      // A link to a Tron chain must not silently reconnect the last (EVM) wallet
      jest.spyOn(chainIdHooks, 'useUrlChainId').mockReturnValue('728126428')
      rerender()

      await waitFor(() => {
        expect(mockOnboardApi.state.actions.setWalletModules).toHaveBeenCalledTimes(3)
      })
      await new Promise((resolve) => setTimeout(resolve, 0))
      expect(mockOnboardApi.connectWallet).toHaveBeenCalledTimes(1)
    })
  })
})
