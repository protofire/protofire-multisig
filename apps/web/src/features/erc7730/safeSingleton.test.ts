import type { Descriptor, DescriptorResolver } from '@ethereum-sourcify/clear-signing'
import { faker } from '@faker-js/faker'
import { AbiCoder, getAddress, keccak256, makeError, ZeroAddress } from 'ethers'
import { setWeb3ReadOnly } from '@/hooks/wallets/web3ReadOnly'
import {
  fetchSafeSingleton,
  getSafeSingleton,
  isSafeProxyCode,
  MASTER_COPY_SELECTOR,
  SAFE_PROXY_CODE_HASHES,
  SINGLETON_LOOKUP_TIMEOUT_MS,
  withSafeSingletonAlias,
  type ContractCaller,
} from './safeSingleton'
import { SAFE_PROXY_RUNTIME_CODE_1_4_1 } from './testHelpers'

const encodeAddress = (address: string): string => AbiCoder.defaultAbiCoder().encode(['address'], [address])

const createCaller = (call: ContractCaller['call'], code: string = SAFE_PROXY_RUNTIME_CODE_1_4_1): ContractCaller => ({
  call,
  getCode: jest.fn().mockResolvedValue(code),
})

const createResolver = (calldataIndex: Record<string, string>): DescriptorResolver => ({
  index: { calldataIndex, typedDataIndex: {} },
  fetchDescriptor: jest.fn(),
})

describe('isSafeProxyCode', () => {
  it('recognises the canonical proxy runtime bytecode', () => {
    expect(isSafeProxyCode(SAFE_PROXY_RUNTIME_CODE_1_4_1)).toBe(true)
    expect(keccak256(SAFE_PROXY_RUNTIME_CODE_1_4_1)).toBe(SAFE_PROXY_CODE_HASHES['1.4.1'])
  })

  it.each([
    ['an EOA', '0x'],
    ['other bytecode', '0x6080604052600080fd'],
    ['tampered proxy bytecode', SAFE_PROXY_RUNTIME_CODE_1_4_1.slice(0, -2) + '00'],
  ])('rejects %s', (_, code) => {
    expect(isSafeProxyCode(code)).toBe(false)
  })
})

describe('fetchSafeSingleton', () => {
  it('calls masterCopy() on a verified proxy and returns the checksummed singleton', async () => {
    const proxy = faker.finance.ethereumAddress()
    const singleton = faker.finance.ethereumAddress()
    const call = jest.fn().mockResolvedValue(encodeAddress(singleton))
    const caller = createCaller(call)

    await expect(fetchSafeSingleton(caller, proxy)).resolves.toBe(getAddress(singleton))
    expect(caller.getCode).toHaveBeenCalledWith(proxy)
    expect(call).toHaveBeenCalledWith({ to: proxy, data: MASTER_COPY_SELECTOR })
  })

  it('never asks a contract with unknown bytecode for its singleton, even if it would answer', async () => {
    const call = jest.fn().mockResolvedValue(encodeAddress(faker.finance.ethereumAddress()))
    const caller = createCaller(call, '0x6080604052600080fd')

    await expect(fetchSafeSingleton(caller, faker.finance.ethereumAddress())).resolves.toBeUndefined()
    expect(call).not.toHaveBeenCalled()
  })

  it.each([
    ['empty return data', '0x'],
    ['short return data', '0x1234'],
    ['the zero address', encodeAddress(ZeroAddress)],
  ])('returns undefined for %s', async (_, returnData) => {
    const caller = createCaller(jest.fn().mockResolvedValue(returnData))
    await expect(fetchSafeSingleton(caller, faker.finance.ethereumAddress())).resolves.toBeUndefined()
  })

  it('returns undefined when the contract reverts', async () => {
    const revert = makeError('execution reverted', 'CALL_EXCEPTION', {
      action: 'call',
      data: null,
      reason: null,
      transaction: { to: faker.finance.ethereumAddress(), data: MASTER_COPY_SELECTOR },
      invocation: null,
      revert: null,
    })
    const caller = createCaller(jest.fn().mockRejectedValue(revert))
    await expect(fetchSafeSingleton(caller, faker.finance.ethereumAddress())).resolves.toBeUndefined()
  })

  it('rethrows transport failures', async () => {
    const caller = createCaller(jest.fn().mockRejectedValue(new Error('network down')))
    await expect(fetchSafeSingleton(caller, faker.finance.ethereumAddress())).rejects.toThrow('network down')
  })
})

describe('getSafeSingleton', () => {
  afterEach(() => {
    setWeb3ReadOnly(undefined)
    jest.useRealTimers()
  })

  it('gives up on an RPC that never answers and retries on the next request', async () => {
    jest.useFakeTimers()
    const proxy = faker.finance.ethereumAddress()
    const singleton = faker.finance.ethereumAddress()
    const call = jest
      .fn()
      .mockReturnValueOnce(new Promise(() => {}))
      .mockResolvedValue(encodeAddress(singleton))
    setWeb3ReadOnly(createCaller(call) as never)

    const pending = expect(getSafeSingleton(1, proxy)).rejects.toThrow('timed out')
    await jest.advanceTimersByTimeAsync(SINGLETON_LOOKUP_TIMEOUT_MS)
    await pending

    await expect(getSafeSingleton(1, proxy)).resolves.toBe(getAddress(singleton))
  })

  it('rejects without a read-only provider and retries once one is available', async () => {
    const proxy = faker.finance.ethereumAddress()
    const singleton = faker.finance.ethereumAddress()

    await expect(getSafeSingleton(1, proxy)).rejects.toThrow('No RPC provider')

    const call = jest.fn().mockResolvedValue(encodeAddress(singleton))
    setWeb3ReadOnly(createCaller(call) as never)

    await expect(getSafeSingleton(1, proxy)).resolves.toBe(getAddress(singleton))
    await expect(getSafeSingleton(1, getAddress(proxy))).resolves.toBe(getAddress(singleton))
    expect(call).toHaveBeenCalledTimes(1)
  })
})

describe('withSafeSingletonAlias', () => {
  const path = 'registry/safe/calldata-Safe-1.4.1.json'

  const unchanged = (resolver: DescriptorResolver) => ({ attestation: resolver, format: resolver })

  it('returns the resolver untouched when the target is indexed directly', async () => {
    const to = faker.finance.ethereumAddress()
    const resolver = createResolver({ [`eip155:1:${to.toLowerCase()}`]: path })
    const getSingleton = jest.fn()

    await expect(withSafeSingletonAlias(resolver, 1, to, getSingleton)).resolves.toEqual(unchanged(resolver))
    expect(getSingleton).not.toHaveBeenCalled()
  })

  it('aliases a Safe proxy to its singleton descriptor without mutating the registry resolver', async () => {
    const proxy = faker.finance.ethereumAddress()
    const singleton = faker.finance.ethereumAddress()
    const resolver = createResolver({ [`eip155:1:${singleton.toLowerCase()}`]: path })
    const getSingleton = jest.fn().mockResolvedValue(singleton)

    const { attestation, format } = await withSafeSingletonAlias(resolver, 1, proxy, getSingleton)

    expect(getSingleton).toHaveBeenCalledWith(1, proxy)
    expect(attestation.index.calldataIndex[`eip155:1:${proxy.toLowerCase()}`]).toBe(path)
    expect(format.index).toBe(attestation.index)
    expect(attestation.fetchDescriptor).toBe(resolver.fetchDescriptor)
    expect(resolver.index.calldataIndex[`eip155:1:${proxy.toLowerCase()}`]).toBeUndefined()
  })

  it('binds the aliased descriptor to the proxy for formatting only', async () => {
    const proxy = faker.finance.ethereumAddress()
    const singleton = faker.finance.ethereumAddress()
    const descriptor: Descriptor = {
      includes: 'common-Safe.json',
      context: { contract: { deployments: [{ chainId: 1, address: singleton }] } },
    }
    const included: Descriptor = { display: { formats: {} } }
    const resolver = createResolver({ [`eip155:1:${singleton.toLowerCase()}`]: path })
    jest
      .mocked(resolver.fetchDescriptor)
      .mockImplementation(async (descriptorPath) => (descriptorPath === path ? descriptor : included))

    const { attestation, format } = await withSafeSingletonAlias(resolver, 1, proxy, async () => singleton)

    await expect(attestation.fetchDescriptor(path)).resolves.toBe(descriptor)
    await expect(format.fetchDescriptor(path)).resolves.toEqual({
      ...descriptor,
      context: {
        contract: {
          deployments: [
            { chainId: 1, address: singleton },
            { chainId: 1, address: proxy },
          ],
        },
      },
    })
    await expect(format.fetchDescriptor('registry/safe/common-Safe.json')).resolves.toBe(included)
  })

  it.each([
    ['the target is not a Safe proxy', jest.fn().mockResolvedValue(undefined)],
    ['the singleton has no descriptor', jest.fn().mockResolvedValue(faker.finance.ethereumAddress())],
    ['the singleton cannot be read', jest.fn().mockRejectedValue(new Error('network down'))],
  ])('returns the resolver untouched when %s', async (_, getSingleton) => {
    const resolver = createResolver({ [`eip155:1:${faker.finance.ethereumAddress()}`]: path })

    await expect(withSafeSingletonAlias(resolver, 1, faker.finance.ethereumAddress(), getSingleton)).resolves.toEqual(
      unchanged(resolver),
    )
  })

  it('only aliases within the same chain', async () => {
    const proxy = faker.finance.ethereumAddress()
    const singleton = faker.finance.ethereumAddress()
    const resolver = createResolver({ [`eip155:1:${singleton.toLowerCase()}`]: path })

    await expect(withSafeSingletonAlias(resolver, 100, proxy, async () => singleton)).resolves.toEqual(
      unchanged(resolver),
    )
  })
})
