import type { SessionTypes } from '@walletconnect/types'
import type { WalletHelpers, WalletModule } from '@web3-onboard/common'
import type { Chain, RpcUri } from '@safe-global/store/gateway/AUTO_GENERATED/chains'
import { FEATURES } from '@safe-global/utils/utils/chains'
import { chainBuilder } from '@/tests/builders/chains'

jest.mock('@/config/constants', () => ({
  ...jest.requireActual('@/config/constants'),
  WC_PROJECT_ID: 'test-project-id',
}))

const mockGetHederaEvmAddress = jest.fn()
const mockGetHederaContractId = jest.fn()
const mockGetHederaEvmTransactionHash = jest.fn()
jest.mock('@/utils/hedera', () => ({
  ...jest.requireActual('@/utils/hedera'),
  getHederaEvmAddress: (...args: unknown[]) => mockGetHederaEvmAddress(...args),
  getHederaContractId: (...args: unknown[]) => mockGetHederaContractId(...args),
  getHederaEvmTransactionHash: (...args: unknown[]) => mockGetHederaEvmTransactionHash(...args),
}))

const mockInit = jest.fn().mockResolvedValue(undefined)
const mockOpenModal = jest.fn()
const mockConnectExtension = jest.fn()
const mockDisconnect = jest.fn().mockResolvedValue(true)
const mockSignAndExecuteTransaction = jest.fn()
const mockSessionGetAll = jest.fn().mockReturnValue([])
const mockOn = jest.fn()
const mockSetTheme = jest.fn()

type MockExtension = { id: string; name?: string; available: boolean; availableInIframe?: boolean }

let lastConnectorArgs: unknown[] = []
let lastConnectorInstance: MockDAppConnector | undefined

class MockDAppConnector {
  walletConnectClient = {
    session: { getAll: mockSessionGetAll },
    on: mockOn,
  }

  walletConnectModal = { setTheme: mockSetTheme }

  // Populated asynchronously by findExtensions() in the real SDK — tests set this directly to
  // simulate a detected (or never-detected) HashPack browser extension.
  extensions: MockExtension[] = []

  constructor(...args: unknown[]) {
    lastConnectorArgs = args
    lastConnectorInstance = this
  }

  init = mockInit
  openModal = mockOpenModal
  connectExtension = mockConnectExtension
  disconnect = mockDisconnect
  signAndExecuteTransaction = mockSignAndExecuteTransaction
}

const mockAccountAndLedgerFromSession = jest.fn()

jest.mock('@hashgraph/hedera-wallet-connect', () => ({
  DAppConnector: MockDAppConnector,
  ledgerIdToCAIPChainId: (ledgerId: string) => `hedera:${ledgerId.toLowerCase()}`,
  HederaJsonRpcMethod: {
    GetNodeAddresses: 'hedera_getNodeAddresses',
    SignAndExecuteTransaction: 'hedera_signAndExecuteTransaction',
  },
  HederaSessionEvent: { AccountsChanged: 'accountsChanged', ChainChanged: 'chainChanged' },
  accountAndLedgerFromSession: (...args: unknown[]) => mockAccountAndLedgerFromSession(...args),
  transactionToBase64String: jest.fn().mockReturnValue('base64-tx'),
}))

const mockSetContractId = jest.fn()
const mockSetGas = jest.fn()
const mockSetFunctionParameters = jest.fn()
const mockSetTransactionId = jest.fn()
const mockFreezeWith = jest.fn()

class MockContractExecuteTransaction {
  setContractId(...args: unknown[]) {
    mockSetContractId(...args)
    return this
  }
  setGas(...args: unknown[]) {
    mockSetGas(...args)
    return this
  }
  setFunctionParameters(...args: unknown[]) {
    mockSetFunctionParameters(...args)
    return this
  }
  setTransactionId(...args: unknown[]) {
    mockSetTransactionId(...args)
    return this
  }
  freezeWith(...args: unknown[]) {
    mockFreezeWith(...args)
    return this
  }
}

const mockTransactionIdGenerate = jest.fn().mockReturnValue('mock-transaction-id')

jest.mock('@hiero-ledger/sdk', () => ({
  LedgerId: { fromString: (network: string) => network.toUpperCase() },
  Client: { forName: jest.fn().mockReturnValue('mock-client') },
  ContractId: { fromString: jest.fn().mockReturnValue('mock-contract-id') },
  ContractExecuteTransaction: MockContractExecuteTransaction,
  TransactionId: { generate: (...args: unknown[]) => mockTransactionIdGenerate(...args) },
}))

import HashPackModule, { HASHPACK_MODULE_LABEL } from '../index'

const walletHelpers: WalletHelpers = { device: { type: null, os: null, browser: null } }
const RPC_URI: RpcUri = { authentication: 'NO_AUTHENTICATION', value: 'https://testnet.hashio.io/api' }

const HEDERA_CHAIN_IDS = new Set(['295', '296'])

// Builds a chain fixture equivalent to what the real config service would return: the "HEDERA"
// feature flag set for Hedera chains, absent otherwise — this module gates on that flag alone.
const buildChain = (chainId: string): Chain =>
  chainBuilder()
    .with({
      chainId,
      rpcUri: RPC_URI,
      isTestnet: true,
      features: HEDERA_CHAIN_IDS.has(chainId) ? [FEATURES.HEDERA] : [],
    })
    .build()

// The factory only ever returns a single WalletModule or null (never an array) —
// this narrows the SDK's wider WalletInit return type for test convenience.
const initModule = (chainId: string): WalletModule | null => {
  const result = HashPackModule(buildChain(chainId))(walletHelpers)
  return Array.isArray(result) ? (result[0] ?? null) : result
}

const buildSession = (): SessionTypes.Struct => ({ topic: 'mock-topic' }) as unknown as SessionTypes.Struct

const ACCOUNT_ID = '0.0.10814740'
const EVM_ADDRESS = '0x0000000000000000000000000000000000004d'
const originalGlobalFetch = global.fetch

describe('HashPackModule', () => {
  let setTimeoutSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    mockSessionGetAll.mockReturnValue([])
    mockAccountAndLedgerFromSession.mockReturnValue([{ network: 'TESTNET', account: { toString: () => ACCOUNT_ID } }])
    mockGetHederaEvmAddress.mockResolvedValue(EVM_ADDRESS)
    mockGetHederaContractId.mockResolvedValue('0.0.8923237')
    mockGetHederaEvmTransactionHash.mockResolvedValue(
      '0xdc45fc2a9f8543d50199572a05e149feadd409d142a1cfeba121793d8d3d7dc7',
    )
    // connect() briefly polls dAppConnector.extensions for a detected HashPack browser
    // extension — resolve setTimeout callbacks immediately so that polling (up to
    // EXTENSION_DETECT_ATTEMPTS when no extension is ever detected) doesn't slow down tests.
    setTimeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation(((fn: () => void) => {
      fn()
      return 0 as unknown as NodeJS.Timeout
    }) as typeof setTimeout)
  })

  afterEach(() => {
    global.fetch = originalGlobalFetch
    setTimeoutSpy.mockRestore()
  })

  it('should not be offered on non-Hedera chains', () => {
    const walletModule = initModule('1')
    expect(walletModule).toBeNull()
  })

  it('should be offered on Hedera testnet', () => {
    const walletModule = initModule('296')
    expect(walletModule).not.toBeNull()
    expect(walletModule?.label).toBe(HASHPACK_MODULE_LABEL)
  })

  it('should initialize a DAppConnector requesting only native Hedera methods (never eth_sendTransaction/eip155)', async () => {
    const walletModule = initModule('296')
    await walletModule?.getInterface({} as never)

    expect(mockInit).toHaveBeenCalled()

    const [, network, projectId, methods, , chains] = lastConnectorArgs as [
      unknown,
      string,
      string,
      string[],
      string[],
      string[],
    ]
    expect(network).toBe('TESTNET')
    expect(projectId).toBe('test-project-id')
    expect(methods).toEqual(['hedera_getNodeAddresses', 'hedera_signAndExecuteTransaction'])
    expect(methods).not.toContain('eth_sendTransaction')
    expect(chains).toEqual(['hedera:testnet'])
  })

  it('eth_chainId should return the hex-encoded Hedera testnet chain id', async () => {
    const walletModule = initModule('296')
    const { provider } = (await walletModule?.getInterface({} as never)) ?? {}

    const chainId = await provider?.request({ method: 'eth_chainId', params: [] })
    expect(chainId).toBe('0x128') // 296 in hex
  })

  it('eth_requestAccounts should open the pairing modal and resolve the EVM address via the mirror node', async () => {
    mockOpenModal.mockResolvedValue(buildSession())

    const walletModule = initModule('296')
    const { provider } = (await walletModule?.getInterface({} as never)) ?? {}

    const accounts = await provider?.request({ method: 'eth_requestAccounts', params: [] })
    expect(mockOpenModal).toHaveBeenCalled()
    expect(mockConnectExtension).not.toHaveBeenCalled()
    expect(mockGetHederaEvmAddress).toHaveBeenCalledWith('testnet', ACCOUNT_ID)
    expect(accounts).toEqual([EVM_ADDRESS])
  })

  // Regression: with no HashPack extension (e.g. in an incognito window) connect() falls back to
  // the WalletConnect QR modal, which must render above onboard's own "Connecting…" modal.
  it('should raise the WalletConnect QR modal above the onboard modal', async () => {
    const walletModule = initModule('296')
    await walletModule?.getInterface({} as never)

    expect(mockSetTheme).toHaveBeenCalledWith(
      expect.objectContaining({ themeVariables: expect.objectContaining({ '--wcm-z-index': '1302' }) }),
    )
  })

  // Regression for the reported "redundant WalletConnect modal" UX gap: picking HashPack from
  // our own wallet list, then having to pick HashPack *again* from WalletConnect's own generic
  // modal. When a HashPack browser extension is detected, connect directly to it instead.
  it('eth_requestAccounts should connect directly to a detected HashPack extension, skipping the WalletConnect modal', async () => {
    mockConnectExtension.mockResolvedValue(buildSession())

    const walletModule = initModule('296')
    const { provider } = (await walletModule?.getInterface({} as never)) ?? {}
    lastConnectorInstance!.extensions = [{ id: 'hashpack-ext-id', name: 'HashPack', available: true }]

    const accounts = await provider?.request({ method: 'eth_requestAccounts', params: [] })

    expect(mockConnectExtension).toHaveBeenCalledWith('hashpack-ext-id')
    expect(mockOpenModal).not.toHaveBeenCalled()
    expect(mockGetHederaEvmAddress).toHaveBeenCalledWith('testnet', ACCOUNT_ID)
    expect(accounts).toEqual([EVM_ADDRESS])
  })

  it('should reuse an already-approved session instead of re-opening the modal', async () => {
    mockSessionGetAll.mockReturnValue([buildSession()])

    const walletModule = initModule('296')
    const { provider } = (await walletModule?.getInterface({} as never)) ?? {}

    const accounts = await provider?.request({ method: 'eth_accounts', params: [] })
    expect(accounts).toEqual([EVM_ADDRESS])
    expect(mockOpenModal).not.toHaveBeenCalled()
  })

  // Regression test: the underlying WalletConnect session store is shared across every
  // DAppConnector built with the same project id, so a session paired against a *different*
  // ledger (e.g. left over from Hedera mainnet) must never be silently restored while the app is
  // actually on testnet — 0.0.123 on mainnet and 0.0.123 on testnet are unrelated accounts.
  it('should not restore a cached session paired against a different ledger', async () => {
    mockSessionGetAll.mockReturnValue([buildSession()])
    mockAccountAndLedgerFromSession.mockReturnValue([{ network: 'MAINNET', account: { toString: () => ACCOUNT_ID } }])

    const walletModule = initModule('296') // testnet — the cached session above is mainnet
    const { provider } = (await walletModule?.getInterface({} as never)) ?? {}

    const accounts = await provider?.request({ method: 'eth_accounts', params: [] })
    expect(accounts).toEqual([])

    // eth_requestAccounts must fall through to opening a fresh pairing rather than reusing the
    // wrong-ledger session.
    mockOpenModal.mockResolvedValue(buildSession())
    mockAccountAndLedgerFromSession.mockReturnValue([{ network: 'TESTNET', account: { toString: () => ACCOUNT_ID } }])
    await provider?.request({ method: 'eth_requestAccounts', params: [] })
    expect(mockOpenModal).toHaveBeenCalled()
  })

  it('should translate eth_sendTransaction into a native ContractExecuteTransaction and submit it via hedera_signAndExecuteTransaction', async () => {
    mockSessionGetAll.mockReturnValue([buildSession()])
    mockSignAndExecuteTransaction.mockResolvedValue({
      transactionHash: Buffer.from('deadbeef', 'hex').toString('base64'),
      transactionId: '0.0.10814740@1700000000.000000000',
      nodeId: '0.0.3',
    })

    const walletModule = initModule('296')
    const { provider } = (await walletModule?.getInterface({} as never)) ?? {}

    const params = [{ from: EVM_ADDRESS, to: '0xSafeAddress', data: '0x1234abcd' }]
    const result = await provider?.request({ method: 'eth_sendTransaction', params })

    // The Safe's native contractNum-based id is resolved via the mirror node rather than
    // ContractId.fromEvmAddress(): that helper's evmAddress-based id doesn't reliably survive a
    // serialize → WalletConnect → deserialize round trip (observed: the wallet signs a
    // transaction targeting contract 0.0.0 instead of the intended one).
    expect(mockGetHederaContractId).toHaveBeenCalledWith('testnet', '0xSafeAddress')
    expect(mockSetContractId).toHaveBeenCalledWith('mock-contract-id')
    expect(mockSetGas).toHaveBeenCalledWith(200_000) // default gas, no gas specified in params
    expect(mockSetFunctionParameters).toHaveBeenCalledWith(Uint8Array.from([0x12, 0x34, 0xab, 0xcd]))
    // Client.forName() has no operator account, so freezeWith can't auto-derive a payer/
    // TransactionId — it must be set explicitly first, or freezing throws
    // "`transactionId` must be set or `client` must be provided with `freezeWith`".
    expect(mockTransactionIdGenerate).toHaveBeenCalledWith(ACCOUNT_ID)
    expect(mockSetTransactionId).toHaveBeenCalledWith('mock-transaction-id')
    expect(mockFreezeWith).toHaveBeenCalledWith('mock-client')
    expect(mockSignAndExecuteTransaction).toHaveBeenCalledWith({
      signerAccountId: `hedera:testnet:${ACCOUNT_ID}`,
      transactionList: 'base64-tx',
    })
    // The returned "hash" must be the real EVM-equivalent hash (resolved via the mirror node),
    // not Hedera's own SHA-384 transactionHash — ethers' BrowserProvider polls
    // eth_getTransactionByHash with whatever eth_sendTransaction returns here.
    expect(mockGetHederaEvmTransactionHash).toHaveBeenCalledWith('testnet', '0.0.10814740@1700000000.000000000')
    expect(result).toBe('0xdc45fc2a9f8543d50199572a05e149feadd409d142a1cfeba121793d8d3d7dc7')
  })

  // Regression: WalletConnect's own session-request TTL (~15 minutes) can expire — rejecting with
  // "Request expired. Please try again." — before HashPack's response ever reaches us, even
  // though HashPack actually submitted the transaction and it goes on to succeed on-chain. A
  // mirror-node watch (using the transaction id we generate ourselves, client-side, before ever
  // contacting HashPack) runs *concurrently* with the WalletConnect round trip, so it can resolve
  // the real outcome without waiting for WalletConnect's channel to fail first.
  it('should resolve via the mirror-node watch when signAndExecuteTransaction errors or times out', async () => {
    mockSessionGetAll.mockReturnValue([buildSession()])
    mockSignAndExecuteTransaction.mockRejectedValue(new Error('Request expired. Please try again.'))
    mockGetHederaEvmTransactionHash.mockResolvedValue(
      '0xdc45fc2a9f8543d50199572a05e149feadd409d142a1cfeba121793d8d3d7dc7',
    )

    const walletModule = initModule('296')
    const { provider } = (await walletModule?.getInterface({} as never)) ?? {}

    const params = [{ from: EVM_ADDRESS, to: '0xSafeAddress', data: '0x1234abcd' }]
    const result = await provider?.request({ method: 'eth_sendTransaction', params })

    // 62 attempts (~5 minutes) of mirror-node watching alongside the WalletConnect round trip.
    expect(mockGetHederaEvmTransactionHash).toHaveBeenCalledWith(
      'testnet',
      'mock-transaction-id',
      62,
      expect.any(AbortSignal),
    )
    // Once settled, the watch is told to stop polling the mirror node
    expect(mockGetHederaEvmTransactionHash.mock.calls[0][3].aborted).toBe(true)
    expect(result).toBe('0xdc45fc2a9f8543d50199572a05e149feadd409d142a1cfeba121793d8d3d7dc7')
  })

  it('should propagate an explicit user rejection immediately, without waiting on the mirror-node watch', async () => {
    mockSessionGetAll.mockReturnValue([buildSession()])
    // WalletConnect rejects with a plain JSON-RPC error object, not an Error instance
    mockSignAndExecuteTransaction.mockRejectedValue({ code: 5000, message: 'User rejected.' })
    // Deliberately never resolves — if the fail-fast rejection below didn't actually short-circuit
    // the watch, this test would hang (and time out) instead of incorrectly passing.
    mockGetHederaEvmTransactionHash.mockReturnValue(new Promise(() => {}))

    const walletModule = initModule('296')
    const { provider } = (await walletModule?.getInterface({} as never)) ?? {}

    const params = [{ from: EVM_ADDRESS, to: '0xSafeAddress', data: '0x1234abcd' }]

    // Normalized to EIP-1193's 4001 so ethers/onboard/isWalletRejection treat it as a user decline
    await expect(provider?.request({ method: 'eth_sendTransaction', params })).rejects.toMatchObject({
      code: 4001,
      message: 'User rejected the request.',
    })
  })

  it('should surface a failure if both the WalletConnect round trip and the mirror-node watch fail', async () => {
    mockSessionGetAll.mockReturnValue([buildSession()])
    mockSignAndExecuteTransaction.mockRejectedValue(new Error('Request expired. Please try again.'))
    mockGetHederaEvmTransactionHash.mockRejectedValue(new Error('not found'))

    const walletModule = initModule('296')
    const { provider } = (await walletModule?.getInterface({} as never)) ?? {}

    const params = [{ from: EVM_ADDRESS, to: '0xSafeAddress', data: '0x1234abcd' }]

    await expect(provider?.request({ method: 'eth_sendTransaction', params })).rejects.toThrow()
  })

  it('should reject eth_sendTransaction if the request is not from the connected session account', async () => {
    mockSessionGetAll.mockReturnValue([buildSession()])

    const walletModule = initModule('296')
    const { provider } = (await walletModule?.getInterface({} as never)) ?? {}

    const params = [{ from: '0x000000000000000000000000000000000000ff', to: '0xSafeAddress', data: '0x1234abcd' }]

    await expect(provider?.request({ method: 'eth_sendTransaction', params })).rejects.toThrow('account mismatch')
    expect(mockSignAndExecuteTransaction).not.toHaveBeenCalled()
  })

  it('should reject eth_sendTransaction if a nonzero native value is attached', async () => {
    mockSessionGetAll.mockReturnValue([buildSession()])

    const walletModule = initModule('296')
    const { provider } = (await walletModule?.getInterface({} as never)) ?? {}

    const params = [{ from: EVM_ADDRESS, to: '0xSafeAddress', data: '0x1234abcd', value: '0x1' }]

    await expect(provider?.request({ method: 'eth_sendTransaction', params })).rejects.toThrow('not supported')
    expect(mockSignAndExecuteTransaction).not.toHaveBeenCalled()
  })

  it('should allow eth_sendTransaction with an explicit zero value', async () => {
    mockSessionGetAll.mockReturnValue([buildSession()])
    mockSignAndExecuteTransaction.mockResolvedValue({
      transactionHash: Buffer.from('deadbeef', 'hex').toString('base64'),
      transactionId: '0.0.10814740@1700000000.000000000',
      nodeId: '0.0.3',
    })

    const walletModule = initModule('296')
    const { provider } = (await walletModule?.getInterface({} as never)) ?? {}

    const params = [{ from: EVM_ADDRESS, to: '0xSafeAddress', data: '0x1234abcd', value: '0x0' }]

    await expect(provider?.request({ method: 'eth_sendTransaction', params })).resolves.toBeDefined()
  })

  it('eth_getBalance should proxy the request to the chain RPC endpoint', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ result: '0x8202ebba3cc46000' }),
    })

    const walletModule = initModule('296')
    const { provider } = (await walletModule?.getInterface({} as never)) ?? {}

    const balance = await provider?.request({ method: 'eth_getBalance', params: [EVM_ADDRESS, 'latest'] })

    expect(global.fetch).toHaveBeenCalledWith(
      RPC_URI.value,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_getBalance',
          params: [EVM_ADDRESS, 'latest'],
        }),
      }),
    )
    expect(balance).toBe('0x8202ebba3cc46000')
  })

  // Regression test for a real bug: Safe creation (via ethers' BrowserProvider) calls a range of
  // standard read-only RPC methods directly against the connected wallet's own provider — not
  // just eth_getBalance — including eth_blockNumber, which previously failed outright with
  // "HashPack does not support the requested method: eth_blockNumber" and broke Safe creation
  // for HashPack-connected owners entirely.
  it('should proxy any other standard read-only RPC method (e.g. eth_blockNumber) to the chain RPC endpoint too', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ result: '0x5f59bc9' }),
    })

    const walletModule = initModule('296')
    const { provider } = (await walletModule?.getInterface({} as never)) ?? {}

    const blockNumber = await provider?.request({ method: 'eth_blockNumber', params: [] })

    expect(global.fetch).toHaveBeenCalledWith(
      RPC_URI.value,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }),
      }),
    )
    expect(blockNumber).toBe('0x5f59bc9')
  })

  it('should surface the RPC endpoint error message when a proxied method fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ error: { message: 'execution reverted' } }),
    })

    const walletModule = initModule('296')
    const { provider } = (await walletModule?.getInterface({} as never)) ?? {}

    await expect(provider?.request({ method: 'eth_call', params: [] })).rejects.toThrow('execution reverted')
  })

  it.each(['eth_signTypedData_v4', 'eth_signTypedData', 'personal_sign', 'eth_sign'])(
    'should reject %s as unsupported instead of forwarding it to the RPC relay',
    async (method) => {
      global.fetch = jest.fn()

      const walletModule = initModule('296')
      const { provider } = (await walletModule?.getInterface({} as never)) ?? {}

      await expect(provider?.request({ method, params: [] })).rejects.toMatchObject({
        code: 4200,
        message: expect.stringContaining("HashPack can't create off-chain signatures"),
      })
      expect(global.fetch).not.toHaveBeenCalled()
    },
  )

  // Regression test: Hashio can return a non-JSON error body (e.g. an HTML 502 page) during an
  // outage — response.json() on that would previously throw an opaque JSON-parse error instead
  // of a clear "the RPC endpoint failed" one.
  it('should surface a clear error when the RPC endpoint returns a non-OK HTTP status', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: () => Promise.reject(new Error('Unexpected token < in JSON')),
    })

    const walletModule = initModule('296')
    const { provider } = (await walletModule?.getInterface({} as never)) ?? {}

    await expect(provider?.request({ method: 'eth_blockNumber', params: [] })).rejects.toThrow('HTTP 502')
  })

  it('should support removeListener so callers can tear down their own listeners', async () => {
    // A restored session is required for the session_delete handler to actually notify
    // listeners (it bails out early if there's no active session matching the event's topic).
    mockSessionGetAll.mockReturnValue([buildSession()])

    const walletModule = initModule('296')
    const { provider } = (await walletModule?.getInterface({} as never)) ?? {}

    const listener = jest.fn()
    provider?.on?.('accountsChanged', listener)
    provider?.removeListener?.('accountsChanged', listener)

    // Trigger the underlying session_delete handler, which notifies accountsChanged listeners —
    // the removed listener must not be called.
    const sessionDeleteHandler = mockOn.mock.calls.find(([event]) => event === 'session_delete')?.[1]
    sessionDeleteHandler?.({ topic: 'mock-topic' })

    expect(listener).not.toHaveBeenCalled()
  })

  it('should reject with 4001 when the WalletConnect pairing modal is closed, so onboard leaves "Connecting…"', async () => {
    mockOpenModal.mockRejectedValue(new Error('User rejected pairing'))

    const walletModule = initModule('296')
    const { provider } = (await walletModule?.getInterface({} as never)) ?? {}

    await expect(provider?.request({ method: 'eth_requestAccounts', params: [] })).rejects.toMatchObject({ code: 4001 })
    // throwErrorOnReject — without it, closing the modal never settles the connect promise
    expect(mockOpenModal).toHaveBeenCalledWith(undefined, true)
  })

  it("should not connect through another Hedera wallet's extension under the HashPack label", async () => {
    mockOpenModal.mockResolvedValue(buildSession())

    const walletModule = initModule('296')
    const { provider } = (await walletModule?.getInterface({} as never)) ?? {}
    lastConnectorInstance!.extensions = [{ id: 'kabila-extension', name: 'Kabila', available: true }]

    await provider?.request({ method: 'eth_requestAccounts', params: [] })

    expect(mockConnectExtension).not.toHaveBeenCalled()
    expect(mockOpenModal).toHaveBeenCalled()
  })

  it('should switch to the account HashPack reports in an accountsChanged session event', async () => {
    const OTHER_ACCOUNT_ID = '0.0.10909212'
    const OTHER_EVM_ADDRESS = '0x0000000000000000000000000000000000a6761c'
    mockSessionGetAll.mockReturnValue([buildSession()])
    mockAccountAndLedgerFromSession.mockReturnValue([
      { network: 'TESTNET', account: { toString: () => ACCOUNT_ID } },
      { network: 'TESTNET', account: { toString: () => OTHER_ACCOUNT_ID } },
    ])
    mockGetHederaEvmAddress.mockImplementation(async (_network: string, accountId: string) =>
      accountId === OTHER_ACCOUNT_ID ? OTHER_EVM_ADDRESS : EVM_ADDRESS,
    )

    const walletModule = initModule('296')
    const { provider } = (await walletModule?.getInterface({} as never)) ?? {}
    const listener = jest.fn()
    provider?.on('accountsChanged', listener)

    expect(await provider?.request({ method: 'eth_accounts', params: [] })).toEqual([EVM_ADDRESS])

    const onSessionEvent = mockOn.mock.calls.find(([event]) => event === 'session_event')?.[1]
    onSessionEvent({
      topic: 'mock-topic',
      params: { event: { name: 'accountsChanged', data: [`hedera:testnet:${OTHER_ACCOUNT_ID}`] } },
    })

    await waitForAsync()
    expect(listener).toHaveBeenCalledWith([OTHER_EVM_ADDRESS])
    expect(await provider?.request({ method: 'eth_accounts', params: [] })).toEqual([OTHER_EVM_ADDRESS])
  })
})

const waitForAsync = () =>
  new Promise<void>((resolve) => jest.requireActual<typeof globalThis>('timers').setImmediate(resolve))
