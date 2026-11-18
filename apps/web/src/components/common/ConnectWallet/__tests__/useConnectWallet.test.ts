import type { OnboardAPI, WalletState } from '@web3-onboard/core'
import type { Chain } from '@safe-global/store/gateway/AUTO_GENERATED/chains'
import * as nextRouter from 'next/router'
import { FEATURES } from '@safe-global/utils/utils/chains'
import { renderHook } from '@/tests/test-utils'
import * as onboardHooks from '@/hooks/wallets/useOnboard'
import * as chainIdHooks from '@/hooks/useChainId'
import * as chainsHooks from '@/hooks/useChains'
import useConnectWallet from '../useConnectWallet'

const TRON_CHAIN_ID = '728126428'
const HEDERA_CHAIN_ID = '295'

const CHAINS: Record<string, Chain> = {
  '11155111': { chainId: '11155111', features: [] } as unknown as Chain,
  [TRON_CHAIN_ID]: { chainId: TRON_CHAIN_ID, features: [FEATURES.TRON] } as unknown as Chain,
  [HEDERA_CHAIN_ID]: { chainId: HEDERA_CHAIN_ID, features: [FEATURES.HEDERA] } as unknown as Chain,
}

describe('useConnectWallet', () => {
  const replace = jest.fn()

  const setup = (urlChainId: string | undefined, query: Record<string, string>, label: string) => {
    jest.spyOn(onboardHooks, 'default').mockReturnValue({} as OnboardAPI)
    jest.spyOn(onboardHooks, 'connectWallet').mockResolvedValue([{} as WalletState])
    jest
      .spyOn(onboardHooks, 'getConnectedWallet')
      .mockReturnValue({ label, chainId: TRON_CHAIN_ID } as onboardHooks.ConnectedWallet)
    jest.spyOn(chainIdHooks, 'useUrlChainId').mockReturnValue(urlChainId)
    jest.spyOn(chainsHooks, 'useChain').mockImplementation((chainId) => CHAINS[chainId])
    jest
      .spyOn(nextRouter, 'useRouter')
      .mockReturnValue({ query, pathname: '/new-safe/create', replace } as unknown as nextRouter.NextRouter)
    return renderHook(() => useConnectWallet()).result.current
  }

  beforeEach(() => {
    jest.restoreAllMocks()
    replace.mockClear()
  })

  it('leaves an EVM Safe for the accounts list when TronLink is picked', async () => {
    await setup('11155111', { safe: 'sep:0x1234567890123456789012345678901234567890' }, 'TronLink')()
    expect(replace).toHaveBeenCalledWith('/welcome/accounts')
  })

  it('drops the chain of a page without a Safe when the wallet is of the other family', async () => {
    await setup('11155111', { chain: 'sep', foo: 'bar' }, 'TronLink')()
    expect(replace).toHaveBeenCalledWith({ pathname: '/new-safe/create', query: { foo: 'bar' } })
  })

  it('drops a non-Hedera chain when HashPack is picked', async () => {
    await setup('11155111', { chain: 'sep', foo: 'bar' }, 'HashPack')()
    expect(replace).toHaveBeenCalledWith({ pathname: '/new-safe/create', query: { foo: 'bar' } })
  })

  it('stays when the wallet fits the page chain or the page has no chain', async () => {
    await setup(TRON_CHAIN_ID, { chain: 'tron' }, 'TronLink')()
    await setup(HEDERA_CHAIN_ID, { chain: 'hedera' }, 'HashPack')()
    await setup(HEDERA_CHAIN_ID, { chain: 'hedera' }, 'MetaMask')()
    await setup(undefined, {}, 'TronLink')()
    await setup(undefined, {}, 'HashPack')()
    expect(replace).not.toHaveBeenCalled()
  })
})
