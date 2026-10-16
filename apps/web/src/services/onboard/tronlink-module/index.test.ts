import EventEmitter from 'eventemitter3'
import { http, HttpResponse } from 'msw'
import { BrowserProvider, Interface, TypedDataEncoder } from 'ethers'
import {
  concat,
  createWalletClient,
  custom,
  hashTypedData,
  keccak256,
  recoverAddress,
  stringToHex,
  type Hex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import type { GetInterfaceHelpers, WalletHelpers } from '@web3-onboard/common'
import type { Chain } from '@safe-global/store/gateway/AUTO_GENERATED/chains'
import { signTypedData } from '@safe-global/utils/utils/web3'
import { tronWebTransport } from '@dewpointlabs/viem-tron'
import { server } from '@/tests/server'
import { isWalletRejection } from '@/utils/wallets'
import { UncheckedJsonRpcSigner } from '@/utils/providers/UncheckedJsonRpcSigner'

jest.mock('@dewpointlabs/viem-tron', () => {
  const actual = jest.requireActual('@dewpointlabs/viem-tron')
  return { ...actual, tronWebTransport: jest.fn(actual.tronWebTransport) }
})

import TronLinkModule, { detectTronChainId, isTronLinkOnSupportedNetwork, onTronLinkReady } from './index'

const MAINNET_RPC = 'https://tron-mainnet.example/jsonrpc'
const SHASTA_RPC = 'https://tron-shasta.example/jsonrpc'
const TRON_MESSAGE_PREFIX = stringToHex('\x19TRON Signed Message:\n32')

const mainnetChain = {
  chainId: '728126428',
  rpcUri: { authentication: 'NO_AUTHENTICATION', value: MAINNET_RPC },
  features: [],
} as unknown as Chain

const shastaChain = {
  ...mainnetChain,
  chainId: '2494104990',
  rpcUri: { authentication: 'NO_AUTHENTICATION', value: SHASTA_RPC },
} as unknown as Chain

type MockTronWeb = NonNullable<NonNullable<Window['tronLink']>['tronWeb']>

const walletAccount = privateKeyToAccount(`0x${'12'.repeat(32)}`)
const walletAddress = walletAccount.address.toLowerCase() as Hex
const walletTronHex = `41${walletAddress.slice(2)}`
const contractAddress = `0x${'22'.repeat(20)}` as Hex
const txId = 'ab'.repeat(32)

const makeTronWeb = (host: string): MockTronWeb => ({
  ready: true,
  defaultAddress: { base58: walletTronHex, hex: walletTronHex },
  fullNode: { host },
  address: { toHex: (address) => address, fromHex: (address) => address },
  trx: {
    // TronWeb signs a hex string as a Tron signed message and a transaction object by adding signatures
    sign: jest.fn(async (input: string | object) =>
      typeof input === 'string'
        ? walletAccount.sign({ hash: keccak256(concat([TRON_MESSAGE_PREFIX, `0x${input}`])) })
        : { ...input, signature: ['aa'.repeat(65)] },
    ),
    sendRawTransaction: jest.fn(async (): Promise<unknown> => ({ result: true })),
  },
  transactionBuilder: {
    triggerSmartContract: jest.fn(async (to, _selector, options, _parameters, from) => ({
      result: { result: true },
      transaction: {
        txID: txId,
        raw_data: {
          fee_limit: options.feeLimit,
          contract: [
            {
              type: 'TriggerSmartContract',
              parameter: {
                value: {
                  owner_address: from,
                  contract_address: to,
                  data: options.input,
                  call_value: options.callValue,
                },
              },
            },
          ],
        },
      },
    })),
    triggerConstantContract: jest.fn(async (): Promise<unknown> => ({ result: { result: true } })),
    sendTrx: jest.fn(),
  },
})

describe('detectTronChainId', () => {
  it('detects Shasta from the full node host', () => {
    expect(detectTronChainId('https://api.shasta.trongrid.io')).toBe('2494104990')
  })

  it('detects Nile from the full node host', () => {
    expect(detectTronChainId('https://api.nileex.io')).toBe('3448148188')
  })

  it('detects mainnet from a trongrid.io host', () => {
    expect(detectTronChainId('https://api.trongrid.io')).toBe('728126428')
  })

  it('returns undefined for an unrecognised host', () => {
    expect(detectTronChainId('https://my-private-node.example.com')).toBeUndefined()
  })

  it.each([
    'https://api.trongrid.io.example.com',
    'https://private-node.example.com/shasta',
    'https://shasta@api.trongrid.io.example.com',
  ])('does not infer a chain from an arbitrary URL %s', (host) => {
    expect(detectTronChainId(host)).toBeUndefined()
  })

  it('returns undefined for an empty/undefined host', () => {
    expect(detectTronChainId(undefined)).toBeUndefined()
    expect(detectTronChainId('')).toBeUndefined()
  })
})

describe('isTronLinkOnSupportedNetwork', () => {
  afterEach(() => {
    delete (window as { tronWeb?: unknown }).tronWeb
  })

  it('returns true for a trongrid (mainnet) host when mainnet is configured', () => {
    ;(window as { tronWeb?: unknown }).tronWeb = { fullNode: { host: 'https://api.trongrid.io' } }

    expect(isTronLinkOnSupportedNetwork(['728126428'])).toBe(true)
  })

  it('returns false for a shasta host when only mainnet is configured', () => {
    ;(window as { tronWeb?: unknown }).tronWeb = { fullNode: { host: 'https://api.shasta.trongrid.io' } }

    expect(isTronLinkOnSupportedNetwork(['728126428'])).toBe(false)
  })

  it('returns false when there is no tronWeb to read a host from', () => {
    expect(isTronLinkOnSupportedNetwork(['728126428'])).toBe(false)
  })

  it('rejects an unrecognised host instead of guessing its network', () => {
    ;(window as { tronWeb?: unknown }).tronWeb = { fullNode: { host: 'https://my-private-node.example.com' } }

    expect(isTronLinkOnSupportedNetwork(['728126428'])).toBe(false)
  })
})

describe('onTronLinkReady', () => {
  afterEach(() => {
    delete (window as { tronLink?: unknown }).tronLink
    jest.useRealTimers()
  })

  it('calls back immediately when window.tronLink already exists', () => {
    ;(window as { tronLink?: unknown }).tronLink = {}
    const callback = jest.fn()

    onTronLinkReady(callback)

    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('does not call back while window.tronLink stays absent', () => {
    jest.useFakeTimers()
    const callback = jest.fn()
    onTronLinkReady(callback)

    jest.advanceTimersByTime(1000)

    expect(callback).not.toHaveBeenCalled()
  })

  it('calls back exactly once once window.tronLink appears, and not again afterwards', () => {
    jest.useFakeTimers()
    const callback = jest.fn()
    onTronLinkReady(callback)
    ;(window as { tronLink?: unknown }).tronLink = {}
    jest.advanceTimersByTime(250)

    expect(callback).toHaveBeenCalledTimes(1)

    jest.advanceTimersByTime(1000)

    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('unsubscribe before injection prevents the callback from ever firing', () => {
    jest.useFakeTimers()
    const callback = jest.fn()
    const unsubscribe = onTronLinkReady(callback)

    unsubscribe()
    ;(window as { tronLink?: unknown }).tronLink = {}
    jest.advanceTimersByTime(1000)

    expect(callback).not.toHaveBeenCalled()
  })

  it('gives up silently after 15s with no pending timers', () => {
    jest.useFakeTimers()
    const callback = jest.fn()
    onTronLinkReady(callback)

    jest.advanceTimersByTime(15_000)

    expect(callback).not.toHaveBeenCalled()
    expect(jest.getTimerCount()).toBe(0)
  })
})

describe('TronLinkModule', () => {
  const helpers = { device: { type: null, os: null, browser: null } } as unknown as WalletHelpers
  let rpcRequests: Array<{ url: string; method: string }>

  const getProvider = async (tronWeb: MockTronWeb, chains: Chain[] = [mainnetChain]) => {
    ;(window as { tronLink?: Window['tronLink'] }).tronLink = {
      ready: true,
      request: jest.fn().mockResolvedValue([]),
      tronWeb,
    }

    const wallet = TronLinkModule(mainnetChain.chainId, chains)(helpers)
    if (!wallet || Array.isArray(wallet)) throw new Error('Expected TronLink wallet module')
    const interfaceHelpers = {
      chains: [],
      appMetadata: null,
      EventEmitter,
    } as unknown as GetInterfaceHelpers
    return (await wallet.getInterface(interfaceHelpers)).provider
  }

  beforeEach(() => {
    rpcRequests = []
    server.use(
      ...[MAINNET_RPC, SHASTA_RPC].map((url) =>
        http.post(url, async ({ request }) => {
          const { id, method } = (await request.json()) as { id: number; method: string }
          rpcRequests.push({ url, method })
          return HttpResponse.json({ jsonrpc: '2.0', id, result: '0x1' })
        }),
      ),
    )
  })

  afterEach(() => {
    delete (window as { tronLink?: unknown }).tronLink
    jest.mocked(tronWebTransport).mockClear()
  })

  it('returns null when the TronLink extension is not installed', () => {
    const wallet = TronLinkModule('1', [mainnetChain])(helpers)
    expect(wallet).toBeNull()
  })

  it('returns the TronLink wallet module when the extension is present and a Tron chain is configured', () => {
    ;(window as { tronLink?: unknown }).tronLink = { ready: false, request: jest.fn() }

    const wallet = TronLinkModule('1', [mainnetChain])(helpers)
    expect(wallet).not.toBeNull()
    expect((wallet as { label: string }).label).toBe('TronLink')
  })

  it('returns null when the extension is present but no Tron chain is configured', () => {
    ;(window as { tronLink?: unknown }).tronLink = { ready: false, request: jest.fn() }

    const wallet = TronLinkModule('1', [])(helpers)
    expect(wallet).toBeNull()
  })

  it('rebuilds the transport and emits chainChanged when TronLink changes its node', async () => {
    const provider = await getProvider(makeTronWeb('https://api.trongrid.io'), [mainnetChain, shastaChain])
    const chainChanged = jest.fn()
    provider.on('chainChanged', chainChanged)

    const shastaTronWeb = makeTronWeb('https://api.shasta.trongrid.io')
    ;(window.tronLink as NonNullable<Window['tronLink']>).tronWeb = shastaTronWeb
    window.dispatchEvent(new MessageEvent('message', { data: { message: { action: 'setNode' } } }))

    expect(chainChanged).toHaveBeenCalledWith('0x94a9059e')
    await expect(provider.request({ method: 'eth_chainId' })).resolves.toBe('0x94a9059e')
    await expect(provider.request({ method: 'eth_getBalance', params: [walletAddress, 'latest'] })).resolves.toBe('0x1')
    expect(rpcRequests).toEqual([{ url: SHASTA_RPC, method: 'eth_getBalance' }])
    expect(tronWebTransport).toHaveBeenLastCalledWith(shastaTronWeb, { rpc: SHASTA_RPC })
  })

  it('rebuilds for a replaced TronWeb instance even when the chain id is unchanged', async () => {
    const provider = await getProvider(makeTronWeb('https://api.trongrid.io'))
    const replacement = makeTronWeb('https://api.trongrid.io')
    ;(window.tronLink as NonNullable<Window['tronLink']>).tronWeb = replacement

    window.dispatchEvent(new MessageEvent('message', { data: { message: { action: 'setNode' } } }))
    await provider.request({ method: 'eth_getBalance', params: [walletAddress, 'latest'] })

    expect(tronWebTransport).toHaveBeenLastCalledWith(replacement, { rpc: MAINNET_RPC })
  })

  it('rejects an initially unknown node before creating a transport', async () => {
    await expect(getProvider(makeTronWeb('https://private-node.example.com'))).rejects.toThrow('does not support')
    expect(tronWebTransport).not.toHaveBeenCalled()
  })

  it('cannot switch to a Tron network excluded from this app', async () => {
    const provider = await getProvider(makeTronWeb('https://api.trongrid.io'))
    window.tronLink!.tronWeb = makeTronWeb('https://api.shasta.trongrid.io')
    await expect(
      provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x94a9059e' }] }),
    ).rejects.toThrow('does not support')
    await expect(provider.request({ method: 'eth_chainId' })).rejects.toThrow('does not support')
  })

  it('recovers when the original supported node returns after a temporary disconnect', async () => {
    const tronWeb = makeTronWeb('https://api.trongrid.io')
    const provider = await getProvider(tronWeb)
    delete window.tronLink!.tronWeb
    await expect(provider.request({ method: 'eth_chainId' })).rejects.toThrow('does not support')
    window.tronLink!.tronWeb = tronWeb
    await expect(provider.request({ method: 'eth_chainId' })).resolves.toBe('0x2b6653dc')
  })

  it.each([
    ['an unsupported Tron network', 'https://api.shasta.trongrid.io', [['0x94a9059e']]],
    ['an unrecognised node', 'https://private-node.example.com', []],
  ])('rejects requests after an external switch to %s', async (_name, host, chainChanges) => {
    const provider = await getProvider(makeTronWeb('https://api.trongrid.io'))
    const chainChanged = jest.fn()
    provider.on('chainChanged', chainChanged)
    ;(window.tronLink as NonNullable<Window['tronLink']>).tronWeb = makeTronWeb(host)
    window.dispatchEvent(new MessageEvent('message', { data: { message: { action: 'setNode' } } }))

    expect(chainChanged.mock.calls).toEqual(chainChanges)
    await expect(provider.request({ method: 'eth_getBalance', params: ['0x11', 'latest'] })).rejects.toThrow(
      'network this app does not support',
    )
    expect(rpcRequests).toEqual([])
  })

  it('always reads through the chain RPC URL', async () => {
    const tronWeb = makeTronWeb('https://api.trongrid.io')
    const provider = await getProvider(tronWeb)

    await expect(provider.request({ method: 'eth_getBalance', params: [walletAddress, 'latest'] })).resolves.toBe('0x1')
    expect(rpcRequests).toEqual([{ url: MAINNET_RPC, method: 'eth_getBalance' }])
    expect(tronWebTransport).toHaveBeenLastCalledWith(tronWeb, { rpc: MAINNET_RPC })
  })

  it('fails to initialise with a clear error when the chain has no RPC URL', async () => {
    const chain = { ...mainnetChain, rpcUri: { authentication: 'NO_AUTHENTICATION', value: '' } } as unknown as Chain

    await expect(getProvider(makeTronWeb('https://api.trongrid.io'), [chain])).rejects.toThrow(
      'No RPC URL is configured for Tron chain 728126428',
    )
  })

  it.each([
    ['a string', 'boom', 'boom'],
    ['a plain error', new Error('socket closed'), 'socket closed'],
  ])('rejects with an ordinary error when the transport throws %s', async (_name, thrown, message) => {
    const transport = (() => ({ request: () => Promise.reject(thrown) })) as unknown as ReturnType<
      typeof tronWebTransport
    >
    jest.mocked(tronWebTransport).mockReturnValueOnce(transport)
    const provider = await getProvider(makeTronWeb('https://api.trongrid.io'))

    const error = await provider.request({ method: 'eth_blockNumber' }).catch((error) => error)

    expect(error).toBeInstanceOf(Error)
    expect(error).toMatchObject({ message, code: undefined, data: undefined, cause: thrown })
  })

  describe('with a connected wallet', () => {
    let tronWeb: MockTronWeb
    let provider: Awaited<ReturnType<typeof getProvider>>
    let browserProvider: BrowserProvider

    const typedData = {
      domain: { chainId: 728126428, verifyingContract: contractAddress },
      types: { SafeMessage: [{ name: 'message', type: 'bytes' }] },
      primaryType: 'SafeMessage' as const,
      message: { message: '0x1234' as Hex },
    }
    const digest = hashTypedData(typedData)

    const expectTronSignature = async (signature: string) => {
      expect(signature).toMatch(/^0x[0-9a-f]{128}(3a|3b)$/)
      const v = parseInt(signature.slice(-2), 16) - 31
      const signer = await recoverAddress({
        hash: keccak256(concat([TRON_MESSAGE_PREFIX, digest])),
        signature: `${signature.slice(0, -2)}${v.toString(16)}` as Hex,
      })
      expect(signer).toBe(walletAccount.address)
    }

    const transaction = { from: walletAddress, to: contractAddress, data: '0xdeadbeef' as Hex }
    const sendDirectly = () => provider.request({ method: 'eth_sendTransaction', params: [transaction] })
    const sendThroughEthers = () =>
      new UncheckedJsonRpcSigner(browserProvider, walletAddress).sendTransaction({ ...transaction, gasLimit: 1 })

    beforeEach(async () => {
      tronWeb = makeTronWeb('https://api.trongrid.io')
      provider = await getProvider(tronWeb)
      browserProvider = new BrowserProvider(provider)
    })

    afterEach(() => browserProvider.destroy())

    it.each(['eth_signTypedData_v4', 'eth_signTypedData'])('signs %s with the Tron v offset', async (method) => {
      const signature = await provider.request({ method, params: [walletAddress, JSON.stringify(typedData)] })

      await expectTronSignature(signature as string)
      expect(tronWeb.trx.sign).toHaveBeenCalledTimes(1)
    })

    it('signs typed data sent by an ethers signer', async () => {
      expect(TypedDataEncoder.hash(typedData.domain, typedData.types, typedData.message)).toBe(digest)

      await expectTronSignature(await signTypedData(await browserProvider.getSigner(), typedData))
    })

    it('signs typed data sent by a viem wallet client', async () => {
      const client = createWalletClient({ account: walletAddress, transport: custom(provider) })

      await expectTronSignature(await client.signTypedData(typedData))
    })

    it('reports a cancelled transaction as a wallet rejection on every path', async () => {
      jest.mocked(tronWeb.trx.sign).mockRejectedValue('Confirmation declined by user')
      const client = createWalletClient({ account: walletAddress, transport: custom(provider) })

      const direct = await sendDirectly().catch((error) => error)
      const throughEthers = await sendThroughEthers().catch((error) => error)
      const throughViem = await client.sendTransaction({ ...transaction, chain: null }).catch((error) => error)
      const typedDataSigning = await provider
        .request({ method: 'eth_signTypedData_v4', params: [walletAddress, JSON.stringify(typedData)] })
        .catch((error) => error)

      const rejection = { code: 4001, message: 'User rejected the request. Details: Confirmation declined by user' }
      expect(direct).toMatchObject(rejection)
      expect(typedDataSigning).toMatchObject(rejection)
      expect(throughEthers).toMatchObject({ code: 'ACTION_REJECTED' })
      expect([direct, throughEthers, throughViem, typedDataSigning].map(isWalletRejection)).toEqual([
        true,
        true,
        true,
        true,
      ])
      expect(tronWeb.trx.sign).toHaveBeenCalledTimes(4)
      expect(tronWeb.trx.sendRawTransaction).not.toHaveBeenCalled()
    })

    it('reports a signer that rejects with null as a signing failure', async () => {
      jest.mocked(tronWeb.trx.sign).mockRejectedValue(null)
      const message = 'Signing failed: unknown error'

      const direct = await sendDirectly().catch((error) => error)
      const throughEthers = await sendThroughEthers().catch((error) => error)

      expect(direct).toMatchObject({ code: -32003, message, data: undefined })
      expect(throughEthers).toMatchObject({ code: 'UNKNOWN_ERROR', message: expect.stringContaining(message) })
      expect([direct, throughEthers].map(isWalletRejection)).toEqual([false, false])
      expect(tronWeb.trx.sendRawTransaction).not.toHaveBeenCalled()
    })

    const simulation = () => jest.mocked(tronWeb.transactionBuilder.triggerConstantContract)

    it.each([
      [
        'a reverting simulation',
        () => simulation().mockRejectedValue(new Error('REVERT opcode executed')),
        'The transaction would revert: REVERT opcode executed',
        0,
      ],
      [
        'a simulation out of energy',
        () => simulation().mockRejectedValue(new Error('OUT_OF_ENERGY')),
        'The transaction would run out of energy.',
        0,
      ],
      [
        'an unavailable simulation',
        () => simulation().mockRejectedValue(new Error('Request failed with status code 429')),
        'The transaction could not be simulated: Request failed with status code 429',
        0,
      ],
      [
        'a refused simulation',
        () => simulation().mockResolvedValue({ result: { result: false } }),
        'The transaction could not be simulated: unexpected answer from the node',
        0,
      ],
      [
        'a refusal by the node',
        () =>
          jest
            .mocked(tronWeb.trx.sendRawTransaction)
            .mockResolvedValue({ code: 'SIGERROR', message: 'Validate signature error' }),
        'The node refused the transaction: Validate signature error',
        2,
      ],
    ])('keeps the reason visible on %s', async (_name, arrange, message, walletPrompts) => {
      arrange()

      await expect(sendDirectly()).rejects.toMatchObject({ code: -32003, message })
      const throughEthers = await sendThroughEthers().catch((error) => error)

      expect(throughEthers.message).toContain(message)
      expect(isWalletRejection(throughEthers)).toBe(false)
      expect(tronWeb.trx.sign).toHaveBeenCalledTimes(walletPrompts)
    })

    it.each([
      ['a 4001 code', { code: 4001 }],
      [
        'circular data',
        (() => {
          const data: { self?: unknown } = {}
          data.self = data
          return { data }
        })(),
      ],
    ])('does not take %s from a foreign error inside a build failure', async (_name, extra) => {
      jest
        .mocked(tronWeb.transactionBuilder.triggerSmartContract)
        .mockRejectedValue(Object.assign(new Error('node exploded'), extra))
      const message = 'The transaction could not be built: node exploded'

      const direct = await sendDirectly().catch((error) => error)
      const throughEthers = await sendThroughEthers().catch((error) => error)

      expect(direct).toMatchObject({ code: -32003, message, data: undefined })
      expect(throughEthers).toMatchObject({ code: 'UNKNOWN_ERROR', message: expect.stringContaining(message) })
      expect([direct, throughEthers].map(isWalletRejection)).toEqual([false, false])
      expect(tronWeb.trx.sign).not.toHaveBeenCalled()
    })

    it('passes the revert data of a forwarded read to ethers', async () => {
      const data = new Interface(['error Error(string)']).encodeErrorResult('Error', ['nope'])
      server.use(
        http.post(MAINNET_RPC, async ({ request }) => {
          const { id } = (await request.json()) as { id: number }
          return HttpResponse.json({
            jsonrpc: '2.0',
            id,
            error: { code: -32000, message: 'REVERT opcode executed', data },
          })
        }),
      )
      const call = { to: contractAddress, data: '0xdeadbeef' }

      await expect(browserProvider.call(call)).rejects.toMatchObject({ code: 'CALL_EXCEPTION', data, reason: 'nope' })
      await expect(browserProvider.estimateGas(call)).rejects.toMatchObject({ code: 'CALL_EXCEPTION', data })
    })

    it.each([
      ['throws', () => Promise.reject(new Error('timeout of 30000ms exceeded'))],
      ['answers that it already has the transaction', () => Promise.resolve({ code: 'DUP_TRANSACTION_ERROR' })],
      ['fails in the node after it may have queued the transaction', () => Promise.resolve({ code: 'OTHER_ERROR' })],
    ])('returns the transaction id for monitoring when the broadcast %s', async (_name, broadcast) => {
      jest.mocked(tronWeb.trx.sendRawTransaction).mockImplementation(broadcast)

      await expect(sendDirectly()).resolves.toBe(`0x${txId}`)
      await expect(sendThroughEthers()).resolves.toMatchObject({ hash: `0x${txId}` })
      expect(tronWeb.trx.sendRawTransaction).toHaveBeenCalledTimes(2)
    })
  })
})
