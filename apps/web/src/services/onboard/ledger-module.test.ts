import EventEmitter from 'eventemitter3'
import type { EIP1193Provider, GetInterfaceHelpers } from '@web3-onboard/common'
import type { Account, Asset, BasePath } from '@web3-onboard/hw-common'
import { showLedgerHashComparison } from '@/features/ledger'
import { ledgerModule } from './ledger-module'

/**
 * These mocks stub the Ledger Device Management Kit (DMK) so we can drive the EIP-1193
 * provider without a real device. The behaviour under test is `withRefresherPaused`: the
 * device-session refresher must be suspended around every on-device signing call and always
 * resumed afterwards (see the DMK 0.9.1 InvalidStatusWordError backport in ledger-module.ts).
 */
const mockStartDiscovering = jest.fn()
const mockConnect = jest.fn()
const mockDisconnect = jest.fn()
const mockDisableDeviceSessionRefresher = jest.fn()
const mockGetAddress = jest.fn()
const mockSignMessage = jest.fn()
const mockSignTransaction = jest.fn()
const mockSignTypedData = jest.fn()
const mockAccountSelect = jest.fn()
const mockTransactionFrom = jest.fn<
  { unsignedSerialized: string; serialized: string; signature: undefined },
  [Record<string, unknown>]
>(() => ({
  unsignedSerialized: '0xunsigned',
  serialized: '0xsignedtx',
  signature: undefined,
}))
const mockGetRskAddress = jest.fn<string, [string]>((address) => address)

// A device action returning a Completed/Error state, as consumed by `waitForAction`.
const completed = (output: unknown) => ({
  observable: {
    subscribe: (observer: { next: (state: unknown) => void }) => {
      observer.next({ status: 'completed', output })
      return { unsubscribe: () => {} }
    },
  },
})
const errored = (error: unknown) => ({
  observable: {
    subscribe: (observer: { next: (state: unknown) => void }) => {
      observer.next({ status: 'error', error })
      return { unsubscribe: () => {} }
    },
  },
})

jest.mock(
  '@ledgerhq/device-management-kit',
  () => ({
    DeviceActionStatus: { NotStarted: 'not-started', Pending: 'pending', Completed: 'completed', Error: 'error' },
    hexaStringToBuffer: () => new Uint8Array([1, 2, 3]),
    DeviceManagementKitBuilder: class {
      addTransport() {
        return this
      }
      build() {
        return {
          startDiscovering: (...args: unknown[]) => mockStartDiscovering(...args),
          connect: (...args: unknown[]) => mockConnect(...args),
          disconnect: (...args: unknown[]) => mockDisconnect(...args),
          disableDeviceSessionRefresher: (...args: unknown[]) => mockDisableDeviceSessionRefresher(...args),
        }
      }
    },
  }),
  { virtual: true },
)

jest.mock(
  '@ledgerhq/device-transport-kit-web-hid',
  () => ({
    webHidTransportFactory: 'transport-factory',
    webHidIdentifier: 'web-hid',
  }),
  { virtual: true },
)

jest.mock(
  '@ledgerhq/device-signer-kit-ethereum',
  () => ({
    SignerEthBuilder: class {
      build() {
        return {
          getAddress: (...args: unknown[]) => mockGetAddress(...args),
          signMessage: (...args: unknown[]) => mockSignMessage(...args),
          signTransaction: (...args: unknown[]) => mockSignTransaction(...args),
          signTypedData: (...args: unknown[]) => mockSignTypedData(...args),
        }
      }
    },
  }),
  { virtual: true },
)

jest.mock('rxjs', () => ({
  lastValueFrom: async (value: unknown) => value,
}))

jest.mock('ethers', () => ({
  makeError: (message: string, code: string, extra: object) => Object.assign(new Error(message), { code, ...extra }),
  Signature: { from: () => ({ serialized: '0xserialized' }) },
  Transaction: { from: (txLike: Record<string, unknown>) => mockTransactionFrom(txLike) },
  keccak256: () => '0xhash',
  JsonRpcProvider: class {
    getBalance() {
      return Promise.resolve(0)
    }
  },
}))

jest.mock('@ethersproject/bignumber', () => ({
  BigNumber: { from: (value: unknown) => ({ value, isZero: () => true }) },
}))

jest.mock('@safe-global/utils/utils/rsk-utils', () => ({
  getRskAddress: (address: string) => mockGetRskAddress(address),
}))

jest.mock('@web3-onboard/common', () => ({
  createEIP1193Provider: (
    _baseRequest: unknown,
    handlers: Record<string, (args: { params: unknown[] }) => Promise<unknown>>,
  ) => ({
    request: async ({ method, params }: { method: string; params: unknown[] }) => {
      if (!handlers[method]) throw new Error(`Unhandled method: ${method}`)
      return handlers[method]({ params })
    },
  }),
  ProviderRpcError: class extends Error {},
  ProviderRpcErrorCode: { UNRECOGNIZED_CHAIN_ID: 4902 },
}))

jest.mock('@web3-onboard/hw-common', () => ({
  accountSelect: (...args: unknown[]) => mockAccountSelect(...args),
  getHardwareWalletProvider: () => () => Promise.reject(new Error('RPC not available in test')),
}))

jest.mock('@/features/ledger', () => ({
  showLedgerHashComparison: jest.fn(),
  hideLedgerHashComparison: jest.fn(),
}))

const SESSION_ID = 'session-123'
let callOrder: string[]

const buildProvider = async (chainId = '0x1', rootstockSupport = true): Promise<EIP1193Provider> => {
  const wallet = ledgerModule(rootstockSupport ? ['30', '31'] : [])(
    {} as Parameters<ReturnType<typeof ledgerModule>>[0],
  )
  if (!wallet || Array.isArray(wallet)) throw new Error('Expected a single wallet module')

  const helpers: GetInterfaceHelpers = {
    chains: [{ id: chainId, rpcUrl: 'https://rpc.test', label: 'Test', token: 'ETH' }],
    appMetadata: null,
    EventEmitter,
  }
  const { provider } = await wallet.getInterface(helpers)
  return provider
}

// Selects an account so that `getAssertedDerivationPath` resolves during signing.
const connectAccount = async (provider: EIP1193Provider) => {
  await provider.request({ method: 'eth_requestAccounts' })
}

describe('ledgerModule signing', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    callOrder = []

    mockStartDiscovering.mockReturnValue({ id: 'device-1' })
    mockConnect.mockResolvedValue(SESSION_ID)
    mockDisconnect.mockResolvedValue(undefined)
    mockDisableDeviceSessionRefresher.mockImplementation(() => {
      callOrder.push('disable')
      return () => callOrder.push('resume')
    })
    mockAccountSelect.mockResolvedValue([
      { derivationPath: "44'/60'/0'/0", address: '0xACC', balance: { asset: 'ETH', value: {} } },
    ])
    mockSignTypedData.mockImplementation(() => {
      callOrder.push('sign')
      return completed({ r: '0x1', s: '0x2', v: 27 })
    })
    mockSignMessage.mockImplementation(() => {
      callOrder.push('sign')
      return completed({ r: '0x1', s: '0x2', v: 27 })
    })
    mockSignTransaction.mockImplementation(() => {
      callOrder.push('sign')
      return completed({ r: '0x1', s: '0x2', v: 27 })
    })
  })

  it('pauses and resumes the device-session refresher around signTypedData', async () => {
    const provider = await buildProvider()
    await connectAccount(provider)

    const typedData = JSON.stringify({ types: {}, domain: {}, primaryType: 'X', message: {} })
    const signature = await provider.request({ method: 'eth_signTypedData', params: ['0xACC', typedData] })

    expect(mockDisableDeviceSessionRefresher).toHaveBeenCalledTimes(1)
    expect(mockDisableDeviceSessionRefresher).toHaveBeenCalledWith({ sessionId: SESSION_ID, blockerId: 'safe-signing' })
    expect(callOrder).toEqual(['disable', 'sign', 'resume'])
    expect(signature).toBe('0xserialized')
  })

  it('pauses and resumes the refresher around signMessage (eth_sign)', async () => {
    const provider = await buildProvider()
    await connectAccount(provider)

    await provider.request({ method: 'eth_sign', params: ['0xACC', '0xdeadbeef'] })

    expect(mockDisableDeviceSessionRefresher).toHaveBeenCalledTimes(1)
    expect(callOrder).toEqual(['disable', 'sign', 'resume'])
  })

  it('pauses and resumes the refresher around signTransaction', async () => {
    const provider = await buildProvider()
    await connectAccount(provider)

    const signed = await provider.request({
      method: 'eth_signTransaction',
      params: [{ to: '0xTO', value: '0x1', gas: '0x5208', nonce: '0x1', data: '0x' }],
    })

    expect(mockDisableDeviceSessionRefresher).toHaveBeenCalledTimes(1)
    expect(callOrder).toEqual(['disable', 'sign', 'resume'])
    expect(signed).toBe('0xsignedtx')
  })

  it('resumes the refresher even when signing fails', async () => {
    mockSignTypedData.mockImplementation(() => {
      callOrder.push('sign')
      return errored({ message: 'device error' })
    })

    const provider = await buildProvider()
    await connectAccount(provider)

    const typedData = JSON.stringify({ types: {}, domain: {}, primaryType: 'X', message: {} })
    await expect(provider.request({ method: 'eth_signTypedData', params: ['0xACC', typedData] })).rejects.toThrow()

    expect(callOrder).toEqual(['disable', 'sign', 'resume'])
  })

  it('does not pause the refresher during account selection', async () => {
    const provider = await buildProvider()
    await connectAccount(provider)

    expect(mockDisableDeviceSessionRefresher).not.toHaveBeenCalled()
  })
})

type ScanArgs = { chainId: string; derivationPath: string; asset: Asset }
type AccountSelectArgs = { basePaths: Array<BasePath>; scanAccounts: (args: ScanArgs) => Promise<Array<Account>> }

const getAccountSelectArgs = (): AccountSelectArgs => mockAccountSelect.mock.calls[0][0]

const DEFAULT_ACCOUNT = { derivationPath: "44'/60'/0'/0", address: '0xACC', balance: { asset: 'ETH', value: {} } }
const BASE_PATHS_ETHEREUM = ["44'/60'", "44'/60'/0'"]
const RSK_MAINNET_PATH = "44'/137'/0'/0"
const RSK_TESTNET_PATH = "44'/37310'/0'/0"

describe('ledgerModule Rootstock base paths', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAccountSelect.mockResolvedValue([DEFAULT_ACCOUNT])
  })

  const selectBasePathValues = async (chainId: string, rootstockSupport = true): Promise<Array<string>> => {
    const provider = await buildProvider(chainId, rootstockSupport)
    await connectAccount(provider)
    return getAccountSelectArgs().basePaths.map((basePath) => basePath.value)
  }

  it.each(['0x1e', '0x1f'])('offers Rootstock base paths on chain %s', async (chainId) => {
    expect(await selectBasePathValues(chainId)).toEqual([...BASE_PATHS_ETHEREUM, RSK_MAINNET_PATH, RSK_TESTNET_PATH])
  })

  it('offers only the Ledger base paths on Rootstock chains without the Rootstock support flag', async () => {
    expect(await selectBasePathValues('0x1e', false)).toEqual(BASE_PATHS_ETHEREUM)
  })

  it.each(['0x1', '0x89'])(
    'offers Rootstock base paths on chain %s when another chain has Rootstock support',
    async (chainId) => {
      expect(await selectBasePathValues(chainId)).toEqual([...BASE_PATHS_ETHEREUM, RSK_MAINNET_PATH, RSK_TESTNET_PATH])
    },
  )
})

describe('ledgerModule Rootstock account derivation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAccountSelect.mockResolvedValue([DEFAULT_ACCOUNT])
    mockGetAddress.mockReturnValue(completed({ address: '0xRAW' }))
    mockGetRskAddress.mockImplementation(() => '0xNORMALIZED')
  })

  const scanFirstAccounts = async (chainId: string, derivationPath: string) => {
    const provider = await buildProvider(chainId)
    await connectAccount(provider)
    return getAccountSelectArgs().scanAccounts({ chainId, derivationPath, asset: { label: 'ETH' } })
  }

  it('scans Rootstock base paths by index on Rootstock chains', async () => {
    const accounts = await scanFirstAccounts('0x1e', RSK_MAINNET_PATH)

    expect(mockGetAddress.mock.calls[0][0]).toBe("44'/137'/0'/0/0")
    expect(mockGetAddress.mock.calls[1][0]).toBe("44'/137'/0'/0/1")
    expect(accounts.length).toBeGreaterThan(1)
  })

  it('normalizes the device address for Rootstock paths', async () => {
    const accounts = await scanFirstAccounts('0x1e', RSK_MAINNET_PATH)

    expect(mockGetRskAddress).toHaveBeenCalledWith('0xRAW')
    expect(accounts[0].address).toBe('0xNORMALIZED')
  })

  it('passes skipOpenApp to getAddress only for Rootstock paths', async () => {
    await scanFirstAccounts('0x1e', RSK_TESTNET_PATH)

    expect(mockGetAddress.mock.calls[0]).toEqual(["44'/37310'/0'/0/0", { checkOnDevice: false, skipOpenApp: true }])
  })

  it('keeps the Ledger Live scan and getAddress arguments unchanged on non-Rootstock chains', async () => {
    const accounts = await scanFirstAccounts('0x1', "44'/60'")

    expect(mockGetAddress.mock.calls[0]).toEqual(["44'/60'/0'/0/0", { checkOnDevice: false }])
    expect(mockGetRskAddress).not.toHaveBeenCalled()
    expect(accounts[0].address).toBe('0xRAW')
  })

  it('scans the Rootstock base path by index on non-Rootstock chains', async () => {
    const accounts = await scanFirstAccounts('0x1', RSK_MAINNET_PATH)

    expect(mockGetAddress.mock.calls[1][0]).toBe("44'/137'/0'/0/1")
    expect(accounts.length).toBeGreaterThan(1)
  })

  it('returns only the exact account for a Rootstock-style custom path on non-Rootstock chains', async () => {
    const accounts = await scanFirstAccounts('0x1', "44'/137'/0'/0/3")

    expect(accounts).toHaveLength(1)
    expect(mockGetAddress).toHaveBeenCalledTimes(1)
    expect(mockGetAddress.mock.calls[0][0]).toBe("44'/137'/0'/0/3")
    expect(mockGetRskAddress).not.toHaveBeenCalled()
  })

  it('returns only the exact account for a custom path on Rootstock chains', async () => {
    const accounts = await scanFirstAccounts('0x1e', "44'/137'/0'/0/7")

    expect(accounts).toHaveLength(1)
    expect(mockGetRskAddress).toHaveBeenCalledWith('0xRAW')
  })
})

describe('ledgerModule Rootstock signing options', () => {
  const RSK_ACCOUNT = { derivationPath: "44'/137'/0'/0/0", address: '0xACC', balance: { asset: 'ETH', value: {} } }
  const ETHEREUM_ACCOUNT = { derivationPath: "44'/60'/0'/0/0", address: '0xACC', balance: { asset: 'ETH', value: {} } }
  const typedData = JSON.stringify({ types: {}, domain: {}, primaryType: 'X', message: {} })

  beforeEach(() => {
    jest.clearAllMocks()
    mockDisableDeviceSessionRefresher.mockImplementation(() => () => {})
    mockSignTypedData.mockImplementation(() => completed({ r: '0x1', s: '0x2', v: 27 }))
    mockSignTransaction.mockImplementation(() => completed({ r: '0x1', s: '0x2', v: 27 }))
    mockSignMessage.mockImplementation(() => completed({ r: '0x1', s: '0x2', v: 27 }))
  })

  it('passes skipOpenApp to signTypedData for a Rootstock account', async () => {
    mockAccountSelect.mockResolvedValue([RSK_ACCOUNT])
    const provider = await buildProvider('0x1e')
    await connectAccount(provider)

    await provider.request({ method: 'eth_signTypedData', params: ['0xACC', typedData] })

    expect(mockSignTypedData).toHaveBeenCalledWith("44'/137'/0'/0/0", expect.anything(), { skipOpenApp: true })
    expect(mockDisableDeviceSessionRefresher).toHaveBeenCalledTimes(1)
  })

  it('passes skipOpenApp to signTransaction for a Rootstock account', async () => {
    mockAccountSelect.mockResolvedValue([RSK_ACCOUNT])
    const provider = await buildProvider('0x1e')
    await connectAccount(provider)

    await provider.request({
      method: 'eth_signTransaction',
      params: [{ to: '0xTO', value: '0x1', gas: '0x5208', nonce: '0x1', data: '0x', gasPrice: '0x3e9' }],
    })

    expect(mockSignTransaction.mock.calls[0][2]).toEqual({ skipOpenApp: true })
  })

  it('passes skipOpenApp to signMessage for a Rootstock account', async () => {
    mockAccountSelect.mockResolvedValue([RSK_ACCOUNT])
    const provider = await buildProvider('0x1e')
    await connectAccount(provider)

    await provider.request({ method: 'eth_sign', params: ['0xACC', '0xdeadbeef'] })

    expect(mockSignMessage.mock.calls[0]).toEqual(["44'/137'/0'/0/0", '0xdeadbeef', { skipOpenApp: true }])
  })

  it('calls the signer with no extra argument for a non-Rootstock account', async () => {
    mockAccountSelect.mockResolvedValue([ETHEREUM_ACCOUNT])
    const provider = await buildProvider('0x1')
    await connectAccount(provider)

    await provider.request({ method: 'eth_signTypedData', params: ['0xACC', typedData] })
    await provider.request({ method: 'eth_sign', params: ['0xACC', '0xdeadbeef'] })
    await provider.request({
      method: 'eth_signTransaction',
      params: [{ to: '0xTO', value: '0x1', gas: '0x5208', nonce: '0x1', data: '0x' }],
    })

    expect(mockSignTypedData.mock.calls[0]).toHaveLength(2)
    expect(mockSignMessage.mock.calls[0]).toHaveLength(2)
    expect(mockSignTransaction.mock.calls[0]).toHaveLength(2)
  })

  it('does not pass skipOpenApp for a Rootstock-style path on a non-Rootstock chain', async () => {
    mockAccountSelect.mockResolvedValue([RSK_ACCOUNT])
    const provider = await buildProvider('0x1')
    await connectAccount(provider)

    await provider.request({ method: 'eth_signTypedData', params: ['0xACC', typedData] })
    await provider.request({ method: 'eth_sign', params: ['0xACC', '0xdeadbeef'] })
    await provider.request({
      method: 'eth_signTransaction',
      params: [{ to: '0xTO', value: '0x1', gas: '0x5208', nonce: '0x1', data: '0x' }],
    })

    expect(mockSignTypedData.mock.calls[0]).toHaveLength(2)
    expect(mockSignMessage.mock.calls[0]).toHaveLength(2)
    expect(mockSignTransaction.mock.calls[0]).toHaveLength(2)
  })
})

describe('ledgerModule transaction type', () => {
  const RSK_ACCOUNT = { derivationPath: "44'/137'/0'/0/0", address: '0xACC', balance: { asset: 'ETH', value: {} } }
  const ETHEREUM_ACCOUNT = { derivationPath: "44'/60'/0'/0/0", address: '0xACC', balance: { asset: 'ETH', value: {} } }

  const signWith = async (chainId: string, txParams: Record<string, string>) => {
    mockAccountSelect.mockResolvedValue([chainId === '0x1e' ? RSK_ACCOUNT : ETHEREUM_ACCOUNT])
    const provider = await buildProvider(chainId)
    await connectAccount(provider)
    return provider.request({
      method: 'eth_signTransaction',
      params: [{ to: '0xTO', value: '0x1', gas: '0x5208', nonce: '0x1', data: '0x', ...txParams }],
    })
  }

  const lastTransactionArgs = (): Record<string, unknown> => {
    const { calls } = mockTransactionFrom.mock
    return calls[calls.length - 1][0]
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockDisableDeviceSessionRefresher.mockImplementation(() => () => {})
    mockSignTransaction.mockImplementation(() => completed({ r: '0x1', s: '0x2', v: 27 }))
  })

  it('builds a legacy (type 0) transaction with gasPrice on Rootstock', async () => {
    await signWith('0x1e', { gasPrice: '0x3e9' })

    expect(lastTransactionArgs()).toMatchObject({
      type: 0,
      gasPrice: 1001n,
      maxFeePerGas: null,
      maxPriorityFeePerGas: null,
    })
  })

  it('pins legacy on Rootstock when only one EIP-1559 fee cap is present', async () => {
    await signWith('0x1e', { gasPrice: '0x3e9', maxFeePerGas: '0x10' })

    expect(lastTransactionArgs()).toMatchObject({ type: 0, gasPrice: 1001n, maxFeePerGas: null })
  })

  it('keeps the EIP-1559 fields on Rootstock when both fee caps are present', async () => {
    await signWith('0x1e', { maxFeePerGas: '0x10', maxPriorityFeePerGas: '0x1' })

    expect(lastTransactionArgs()).not.toHaveProperty('type')
    expect(lastTransactionArgs()).toMatchObject({ maxFeePerGas: 16n, maxPriorityFeePerGas: 1n, gasPrice: null })
  })

  it('throws on Rootstock when gasPrice is missing for a legacy transaction', async () => {
    await expect(signWith('0x1e', {})).rejects.toThrow('Rootstock legacy transactions require a gas price')

    expect(mockTransactionFrom).not.toHaveBeenCalled()
    expect(showLedgerHashComparison).not.toHaveBeenCalled()
    expect(mockSignTransaction).not.toHaveBeenCalled()
  })

  it('throws on Rootstock when gasPrice is zero', async () => {
    await expect(signWith('0x1e', { gasPrice: '0x0' })).rejects.toThrow(
      'Rootstock legacy transactions require a gas price',
    )

    expect(mockSignTransaction).not.toHaveBeenCalled()
  })

  it('does not pin a type on non-Rootstock chains for a gasPrice-only transaction', async () => {
    await signWith('0x1', { gasPrice: '0x3e9' })

    expect(lastTransactionArgs()).not.toHaveProperty('type')
    expect(lastTransactionArgs()).toMatchObject({ gasPrice: 1001n, maxFeePerGas: null, maxPriorityFeePerGas: null })
  })

  it('does not require gasPrice on non-Rootstock chains', async () => {
    await signWith('0x1', {})

    expect(lastTransactionArgs()).not.toHaveProperty('type')
    expect(mockSignTransaction).toHaveBeenCalledTimes(1)
  })
})
