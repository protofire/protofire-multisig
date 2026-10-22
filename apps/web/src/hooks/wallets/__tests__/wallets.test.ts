import type { Chain } from '@safe-global/store/gateway/AUTO_GENERATED/chains'
import { FEATURES } from '@safe-global/utils/utils/chains'

const mockInjectedWalletModule = jest.fn((options?: unknown) => ({ label: 'INJECTED', options }))
// TronLinkModule is a factory returning a WalletInit function; the extension gate lives inside
// that function (it may return null), never in the factory itself.
const mockTronlinkModule = jest.fn((chainId: string, tronChains: Chain[]) => {
  const walletInit = jest.fn((): { label: string; chainId: string; tronChains: Chain[] } | null => ({
    label: 'TRONLINK',
    chainId,
    tronChains,
  }))
  return walletInit
})

jest.mock('@web3-onboard/injected-wallets', () => ({
  __esModule: true,
  default: (options?: unknown) => mockInjectedWalletModule(options),
  ProviderLabel: { Detected: 'Detected Wallet' },
}))
jest.mock('@web3-onboard/coinbase', () => ({ __esModule: true, default: () => ({ label: 'COINBASE' }) }))
jest.mock('@web3-onboard/walletconnect', () => ({ __esModule: true, default: () => ({ label: 'WALLETCONNECT_V2' }) }))
jest.mock('@/services/private-key-module', () => ({ __esModule: true, default: () => ({ label: 'PK' }) }))
jest.mock('@/services/onboard/ledger-module', () => ({ ledgerModule: () => ({ label: 'LEDGER' }) }))
jest.mock('@/services/onboard/tronlink-module', () => ({
  __esModule: true,
  TRONLINK_MODULE_LABEL: 'TronLink',
  default: (chainId: string, tronChains: Chain[]) => mockTronlinkModule(chainId, tronChains),
}))

jest.mock('@/services/onboard/hashpack-module', () => ({
  __esModule: true,
  default: (chain: Chain) => ({ label: 'HASHPACK', chainId: chain.chainId }),
}))

import { getAllWallets, getSupportedWallets } from '../wallets'

const tronChain = { chainId: '728126428', disabledWallets: [], features: [FEATURES.TRON] } as unknown as Chain
const tronChainNoTronlink = {
  chainId: '728126428',
  disabledWallets: ['tronlink'],
  features: [FEATURES.TRON],
} as unknown as Chain
const evmChain = { chainId: '1', disabledWallets: [], features: [] } as unknown as Chain
const evmChainNoTronlink = {
  chainId: '1',
  disabledWallets: ['tronlink'],
  features: [],
} as unknown as Chain

const hederaChain = { chainId: '295', disabledWallets: [], features: [FEATURES.HEDERA] } as unknown as Chain

const configs = [tronChain, evmChain]

describe('getSupportedWallets', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    window.matchMedia = jest.fn().mockReturnValue({ matches: false })
  })

  it('returns only TronLink for a Tron chain', () => {
    const wallets = getSupportedWallets(tronChain, configs)

    expect(wallets).toHaveLength(1)
    expect(mockTronlinkModule).toHaveBeenCalledWith('728126428', [tronChain])
  })

  it('includes TronLink alongside the other modules for a non-Tron chain', () => {
    const wallets = getSupportedWallets(evmChain, configs)

    expect(mockTronlinkModule).toHaveBeenCalledWith('1', [tronChain])
    expect(wallets).toContain(mockTronlinkModule.mock.results[0].value)
  })

  it('excludes TronLink for a non-Tron chain with disabledWallets: [tronlink]', () => {
    getSupportedWallets(evmChainNoTronlink, configs)

    expect(mockTronlinkModule).not.toHaveBeenCalled()
  })

  it('always includes the TronLink WalletInit function for a Tron chain (extension gate is inside it, not the factory)', () => {
    const wallets = getSupportedWallets(tronChain, configs)

    expect(wallets).toHaveLength(1)
    expect(typeof wallets[0]).toBe('function')
  })

  it('honors disabledWallets for a Tron chain', () => {
    expect(getSupportedWallets(tronChainNoTronlink, configs)).toEqual([])
    expect(mockTronlinkModule).not.toHaveBeenCalled()
  })

  it('the TronLink WalletInit function returns null when the extension is absent (not filtered by getSupportedWallets)', () => {
    mockTronlinkModule.mockReturnValueOnce(jest.fn(() => null))

    const wallets = getSupportedWallets(tronChain, configs)
    const [tronModuleFn] = wallets as [(helpers: unknown) => unknown]

    expect(wallets).toHaveLength(1)
    expect(tronModuleFn(undefined)).toBeNull()
  })

  it('passes the TronLink duplicate filter to the injected wallet module', () => {
    getSupportedWallets(evmChain, configs)

    expect(mockInjectedWalletModule).toHaveBeenCalledWith({ filter: { TronLink: false } })
  })

  describe('when window.ethereum is TronLink', () => {
    afterEach(() => {
      delete (window as { ethereum?: unknown }).ethereum
    })

    it('also filters the generic Detected Wallet fallback', () => {
      ;(window as { ethereum?: unknown }).ethereum = { isTronLink: true }

      getSupportedWallets(evmChain, configs)

      expect(mockInjectedWalletModule).toHaveBeenCalledWith({
        filter: { TronLink: false, 'Detected Wallet': false },
      })
    })

    it('does not filter Detected Wallet when window.ethereum is not TronLink', () => {
      ;(window as { ethereum?: unknown }).ethereum = { isTronLink: false }

      getSupportedWallets(evmChain, configs)

      expect(mockInjectedWalletModule).toHaveBeenCalledWith({ filter: { TronLink: false } })
    })
  })
})

describe('getAllWallets', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    window.matchMedia = jest.fn().mockReturnValue({ matches: false })
  })

  it('offers the Tron wallet on an EVM chain and the EVM wallets on a Tron chain, as their configs allow', () => {
    const fromEvm = getAllWallets(evmChainNoTronlink, [evmChainNoTronlink, tronChain])
    expect(mockTronlinkModule).toHaveBeenCalledWith('728126428', [tronChain])
    expect(fromEvm).toContain(mockTronlinkModule.mock.results[0].value)

    jest.clearAllMocks()
    const fromTron = getAllWallets(tronChain, [tronChain, evmChainNoTronlink])
    expect(mockTronlinkModule).toHaveBeenCalledTimes(1)
    expect(mockInjectedWalletModule).toHaveBeenCalled()
    expect(fromTron.length).toBeGreaterThan(1)
  })

  it('offers only the current family when no chain of the other family is configured', () => {
    expect(getAllWallets(tronChain, [tronChain])).toHaveLength(1)
  })
})

describe('Hedera wallets', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    window.matchMedia = jest.fn().mockReturnValue({ matches: false })
  })

  it('offers only HashPack and an EIP-6963-less injected wallet on a Hedera chain', () => {
    const wallets = getSupportedWallets(hederaChain, [hederaChain])

    expect(wallets).toEqual([{ label: 'HASHPACK', chainId: '295' }, expect.objectContaining({ label: 'INJECTED' })])
    expect(mockInjectedWalletModule).toHaveBeenCalledWith({ disable6963Support: true })
  })

  it('never offers HashPack on a non-Hedera chain', () => {
    const wallets = getSupportedWallets(evmChain, [evmChain, hederaChain])

    expect(wallets).not.toContainEqual(expect.objectContaining({ label: 'HASHPACK' }))
  })

  it('offers the regular EVM wallets, not the Hedera ones, alongside TronLink on a Tron chain', () => {
    const wallets = getAllWallets(tronChain, [tronChain, hederaChain, evmChain])

    expect(wallets).not.toContainEqual(expect.objectContaining({ label: 'HASHPACK' }))
    expect(wallets).toContainEqual({ label: 'LEDGER' })
  })
})
