import type { OnboardAPI } from '@web3-onboard/core'
import { connectLastWallet } from '../useOnboard'
import { chainBuilder } from '@/tests/builders/chains'
import { FEATURES } from '@safe-global/utils/utils/chains'
import { localItem } from '@/services/local-storage/local'

jest.mock('@/hooks/wallets/wallets', () => ({
  getDefaultWallets: jest.fn(() => []),
}))

// isWalletUnlocked probes window.ethereum._metamask, which doesn't exist in jsdom — mock it so
// connectLastWallet's own eligibility gate (not wallet-unlock state) is what's under test.
jest.mock('@/utils/wallets', () => ({
  ...jest.requireActual('@/utils/wallets'),
  isWalletUnlocked: jest.fn().mockResolvedValue(true),
}))

describe('connectLastWallet', () => {
  const lastWalletStorage = localItem<string>('lastWallet')
  const hederaChain = chainBuilder()
    .with({ chainId: '295', features: [FEATURES.HEDERA] })
    .build()
  const mainnetChain = chainBuilder().with({ chainId: '1', features: [] }).build()

  const mockOnboard = () => ({ connectWallet: jest.fn().mockResolvedValue([]) }) as unknown as OnboardAPI

  afterEach(() => {
    lastWalletStorage.remove()
  })

  it('should reconnect HashPack on a Hedera chain', async () => {
    lastWalletStorage.set('HashPack')
    const onboard = mockOnboard()

    await connectLastWallet(onboard, hederaChain, hederaChain.chainId, [])

    expect(onboard.connectWallet).toHaveBeenCalled()
  })

  it('should reconnect an injected wallet (e.g. MetaMask) on a Hedera chain', async () => {
    lastWalletStorage.set('MetaMask')
    const onboard = mockOnboard()

    await connectLastWallet(onboard, hederaChain, hederaChain.chainId, [])

    expect(onboard.connectWallet).toHaveBeenCalled()
  })

  it('should not reconnect a Hedera-only-excluded wallet (e.g. Ledger) on a Hedera chain', async () => {
    lastWalletStorage.set('Ledger')
    const onboard = mockOnboard()

    await connectLastWallet(onboard, hederaChain, hederaChain.chainId, [])

    expect(onboard.connectWallet).not.toHaveBeenCalled()
  })

  it('should not reconnect a stale HashPack session on a non-Hedera chain', async () => {
    lastWalletStorage.set('HashPack')
    const onboard = mockOnboard()

    await connectLastWallet(onboard, mainnetChain, mainnetChain.chainId, [])

    expect(onboard.connectWallet).not.toHaveBeenCalled()
  })

  it('should reconnect any non-HashPack wallet (e.g. Ledger) on a non-Hedera chain', async () => {
    lastWalletStorage.set('Ledger')
    const onboard = mockOnboard()

    await connectLastWallet(onboard, mainnetChain, mainnetChain.chainId, [])

    expect(onboard.connectWallet).toHaveBeenCalled()
  })
})
