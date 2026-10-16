import EventEmitter from 'eventemitter3'
import type { EIP1193Provider, GetInterfaceHelpers } from '@web3-onboard/common'
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
  Transaction: { from: () => ({ unsignedSerialized: '0xunsigned', serialized: '0xsignedtx', signature: undefined }) },
  keccak256: () => '0xhash',
  JsonRpcProvider: class {},
}))

jest.mock('@ethersproject/bignumber', () => ({ BigNumber: { from: (value: unknown) => ({ value }) } }))

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

const buildProvider = async (): Promise<EIP1193Provider> => {
  const wallet = ledgerModule()({} as Parameters<ReturnType<typeof ledgerModule>>[0])
  if (!wallet || Array.isArray(wallet)) throw new Error('Expected a single wallet module')

  const helpers: GetInterfaceHelpers = {
    chains: [{ id: '0x1', rpcUrl: 'https://rpc.test', label: 'Test', token: 'ETH' }],
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
