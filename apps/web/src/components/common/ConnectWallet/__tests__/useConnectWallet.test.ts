import type { OnboardAPI, WalletState } from '@web3-onboard/core'
import * as nextRouter from 'next/router'
import { renderHook } from '@/tests/test-utils'
import * as onboardHooks from '@/hooks/wallets/useOnboard'
import * as chainIdHooks from '@/hooks/useChainId'
import useConnectWallet from '../useConnectWallet'

const TRON_CHAIN_ID = '728126428'

describe('useConnectWallet', () => {
  const replace = jest.fn()

  const setup = (urlChainId: string | undefined, query: Record<string, string>, label: string) => {
    jest.spyOn(onboardHooks, 'default').mockReturnValue({} as OnboardAPI)
    jest.spyOn(onboardHooks, 'connectWallet').mockResolvedValue([{} as WalletState])
    jest
      .spyOn(onboardHooks, 'getConnectedWallet')
      .mockReturnValue({ label, chainId: TRON_CHAIN_ID } as onboardHooks.ConnectedWallet)
    jest.spyOn(chainIdHooks, 'useUrlChainId').mockReturnValue(urlChainId)
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

  it('stays when the wallet fits the page chain or the page has no chain', async () => {
    await setup(TRON_CHAIN_ID, { chain: 'tron' }, 'TronLink')()
    await setup(undefined, {}, 'TronLink')()
    expect(replace).not.toHaveBeenCalled()
  })
})
