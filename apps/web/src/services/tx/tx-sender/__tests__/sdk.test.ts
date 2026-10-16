import type { OnboardAPI } from '@web3-onboard/core'
import { switchWalletChain } from '../sdk'
import * as useOnboard from '@/hooks/wallets/useOnboard'

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
