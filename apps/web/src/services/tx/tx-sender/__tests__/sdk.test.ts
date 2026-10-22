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

describe('switchWalletChain', () => {
  beforeEach(() => {
    jest.restoreAllMocks()
  })

  it.each([
    ['MetaMask', '1', TRON_CHAIN_ID],
    ['TronLink', TRON_CHAIN_ID, '1'],
  ])('opens the wallet picker instead of switching %s from chain %s to %s', async (label, from, to) => {
    const onboard = makeOnboard(label, from)
    const connectWallet = jest.spyOn(useOnboard, 'connectWallet').mockResolvedValue(undefined)

    await expect(switchWalletChain(onboard, to)).resolves.toBeNull()

    expect(onboard.disconnectWallet).toHaveBeenCalledWith({ label })
    expect(connectWallet).toHaveBeenCalledWith(onboard)
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
