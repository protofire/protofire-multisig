import type { OnboardAPI } from '@web3-onboard/core'
import { switchWalletChain } from '../sdk'
import * as useOnboard from '@/hooks/wallets/useOnboard'
import { chainBuilder } from '@/tests/builders/chains'
import { FEATURES } from '@safe-global/utils/utils/chains'
import * as chainUtils from '@/utils/chains'
import type { ConnectedWallet } from '@/hooks/wallets/useOnboard'

const TRON_CHAIN_ID = '728126428'

const makeOnboard = (label: string, chainId: string) => {
  const wallet = { label, chainId, address: '0x1234567890123456789012345678901234567890', provider: {} }
  jest.spyOn(useOnboard, 'getConnectedWallet').mockReturnValue(wallet as useOnboard.ConnectedWallet)
  return {
    state: { get: () => ({ wallets: [wallet] }) },
    disconnectWallet: jest.fn().mockResolvedValue([]),
  } as unknown as OnboardAPI
}

const HEDERA_MAINNET_ID = '295'
const HEDERA_TESTNET_ID = '296'

const CACHED_CHAINS = {
  '1': chainBuilder().with({ chainId: '1', features: [] }).build(),
  [TRON_CHAIN_ID]: chainBuilder()
    .with({ chainId: TRON_CHAIN_ID, features: [FEATURES.TRON] as never })
    .build(),
  [HEDERA_MAINNET_ID]: chainBuilder()
    .with({ chainId: HEDERA_MAINNET_ID, features: [FEATURES.HEDERA] as never })
    .build(),
  [HEDERA_TESTNET_ID]: chainBuilder()
    .with({ chainId: HEDERA_TESTNET_ID, features: [FEATURES.HEDERA] as never })
    .build(),
}

describe('switchWalletChain', () => {
  beforeEach(() => {
    jest.restoreAllMocks()
    jest
      .spyOn(chainUtils, 'getCachedChainConfig')
      .mockImplementation((chainId) => CACHED_CHAINS[chainId as keyof typeof CACHED_CHAINS])
  })

  it.each([
    ['MetaMask', '1', TRON_CHAIN_ID],
    ['TronLink', TRON_CHAIN_ID, '1'],
    ['HashPack', HEDERA_MAINNET_ID, '1'],
    ['TronLink', TRON_CHAIN_ID, HEDERA_MAINNET_ID],
  ])('opens the wallet picker instead of switching %s from chain %s to %s', async (label, from, to) => {
    const onboard = makeOnboard(label, from)
    const connectWallet = jest.spyOn(useOnboard, 'connectWallet').mockResolvedValue(undefined)

    await expect(switchWalletChain(onboard, to)).resolves.toBeNull()

    expect(onboard.disconnectWallet).toHaveBeenCalledWith({ label })
    expect(connectWallet).toHaveBeenCalledWith(onboard)
  })

  it('falls back to the Tron check when the chain config is not loaded', async () => {
    jest.spyOn(chainUtils, 'getCachedChainConfig').mockReturnValue(undefined)
    const onboard = makeOnboard('MetaMask', '1')
    const connectWallet = jest.spyOn(useOnboard, 'connectWallet').mockResolvedValue(undefined)

    await switchWalletChain(onboard, TRON_CHAIN_ID)

    expect(connectWallet).toHaveBeenCalledWith(onboard)
  })

  it('reconnects HashPack on the other Hedera ledger, since its session is bound to one', async () => {
    const onboard = makeOnboard('HashPack', HEDERA_MAINNET_ID)
    const connectWallet = jest.spyOn(useOnboard, 'connectWallet').mockResolvedValue(undefined)

    await switchWalletChain(onboard, HEDERA_TESTNET_ID)

    expect(onboard.disconnectWallet).toHaveBeenCalledWith({ label: 'HashPack' })
    expect(connectWallet).toHaveBeenCalledWith(onboard, { autoSelect: 'HashPack' })
  })
})

const hbar = { name: 'Hedera', symbol: 'HBAR', decimals: 8, logoUri: 'https://example.com/hbar.png' }

const setup = (chain: ReturnType<ReturnType<typeof chainBuilder>['build']>) => {
  const request = jest.fn(({ method }: { method: string }) =>
    method === 'wallet_switchEthereumChain' ? Promise.reject({ code: 4902 }) : Promise.resolve(null),
  )
  const wallet = {
    label: 'MetaMask',
    chainId: '1',
    address: '0x1',
    provider: { request },
  } as unknown as ConnectedWallet
  jest.spyOn(useOnboard, 'getConnectedWallet').mockReturnValue(wallet)
  jest.spyOn(chainUtils, 'getChainConfig').mockResolvedValue(chain)
  jest.spyOn(chainUtils, 'getCachedChainConfig').mockReturnValue(chain)

  const onboard = {
    state: {
      get: () => ({ wallets: [] }),
      select: () => ({ subscribe: () => ({ unsubscribe: jest.fn() }) }),
    },
  } as unknown as OnboardAPI

  void switchWalletChain(onboard, chain.chainId)

  return request
}

const getAddChainParams = async (request: jest.Mock) => {
  await new Promise((resolve) => setTimeout(resolve, 0))
  const call = request.mock.calls.find(([{ method }]) => method === 'wallet_addEthereumChain')
  return call?.[0].params[0]
}

describe('switchWalletChain', () => {
  afterEach(() => jest.restoreAllMocks())

  it('should add an unknown Hedera chain with 18 native decimals, which wallets require', async () => {
    const request = setup(
      chainBuilder()
        .with({ chainId: '295', features: [FEATURES.HEDERA], nativeCurrency: hbar })
        .build(),
    )

    const params = await getAddChainParams(request)

    expect(params.chainId).toBe('0x127')
    expect(params.nativeCurrency).toMatchObject({ symbol: 'HBAR', decimals: 18 })
  })

  it('should add any other unknown chain with its own native decimals', async () => {
    const request = setup(
      chainBuilder()
        .with({ chainId: '100', features: [], nativeCurrency: { ...hbar, symbol: 'XDAI', decimals: 18 } })
        .build(),
    )

    const params = await getAddChainParams(request)

    expect(params.nativeCurrency).toMatchObject({ symbol: 'XDAI', decimals: 18 })
  })
})
