import type { Descriptor, DescriptorResolver } from '@ethereum-sourcify/clear-signing'
import { AbiCoder, dataLength, isError, keccak256, ZeroAddress, type JsonRpcProvider } from 'ethers'
import { getWeb3ReadOnly } from '@/hooks/wallets/web3ReadOnly'
import { getOrCreate, withTimeout } from './promiseCache'

export const MASTER_COPY_SELECTOR = '0xa619486e'
export const SINGLETON_LOOKUP_TIMEOUT_MS = 10_000

export const SAFE_PROXY_CODE_HASHES: Readonly<Record<string, string>> = {
  '1.3.0': '0xb89c1b3bdf2cf8827818646bce9a8f6e372885f8c55e5c07acbd307cb133b000',
  '1.4.1': '0xd7d408ebcd99b2b70be43e20253d6d92a8ea8fab29bd3be7f55b10032331fb4c',
  '1.5.0': '0x4e381985ca68b3e5d27b4425fa581c19cf33146d3f887a3cfca96f55528ea46f',
}

const KNOWN_PROXY_CODE_HASHES = new Set(Object.values(SAFE_PROXY_CODE_HASHES))

export const isSafeProxyCode = (code: string): boolean =>
  dataLength(code) > 0 && KNOWN_PROXY_CODE_HASHES.has(keccak256(code))

export type ContractCaller = Pick<JsonRpcProvider, 'call' | 'getCode'>

export type SingletonGetter = (chainId: number, address: string) => Promise<string | undefined>

export interface ClearSigningResolvers {
  attestation: DescriptorResolver
  format: DescriptorResolver
}

const toIndexKey = (chainId: number, address: string): string => `eip155:${chainId}:${address.toLowerCase()}`

export const fetchSafeSingleton = async (caller: ContractCaller, address: string): Promise<string | undefined> => {
  if (!isSafeProxyCode(await caller.getCode(address))) {
    return undefined
  }
  let returnData: string
  try {
    returnData = await caller.call({ to: address, data: MASTER_COPY_SELECTOR })
  } catch (error) {
    if (isError(error, 'CALL_EXCEPTION')) {
      return undefined
    }
    throw error
  }
  if (dataLength(returnData) !== 32) {
    return undefined
  }
  const singleton = String(AbiCoder.defaultAbiCoder().decode(['address'], returnData)[0])
  return singleton === ZeroAddress ? undefined : singleton
}

const singletonPromises = new Map<string, Promise<string | undefined>>()

export const getSafeSingleton: SingletonGetter = (chainId, address) =>
  getOrCreate(singletonPromises, toIndexKey(chainId, address), async () => {
    const provider = getWeb3ReadOnly()
    if (!provider) {
      throw new Error('No RPC provider; Safe singleton cannot be read')
    }
    return withTimeout(
      fetchSafeSingleton(provider, address),
      SINGLETON_LOOKUP_TIMEOUT_MS,
      `Safe singleton lookup timed out after ${SINGLETON_LOOKUP_TIMEOUT_MS}ms`,
    )
  })

const withDeployment = (descriptor: Descriptor, chainId: number, address: string): Descriptor => {
  const contract = descriptor.context?.contract
  return {
    ...descriptor,
    context: {
      ...descriptor.context,
      contract: { ...contract, deployments: [...(contract?.deployments ?? []), { chainId, address }] },
    },
  }
}

export const withSafeSingletonAlias = async (
  resolver: DescriptorResolver,
  chainId: number,
  to: string,
  getSingleton: SingletonGetter = getSafeSingleton,
): Promise<ClearSigningResolvers> => {
  const unchanged = { attestation: resolver, format: resolver }
  const { calldataIndex } = resolver.index
  const proxyKey = toIndexKey(chainId, to)
  if (calldataIndex[proxyKey]) {
    return unchanged
  }

  const singleton = await getSingleton(chainId, to).catch(() => undefined)
  const path = singleton && calldataIndex[toIndexKey(chainId, singleton)]
  if (!path) {
    return unchanged
  }

  const attestation = {
    ...resolver,
    index: { ...resolver.index, calldataIndex: { ...calldataIndex, [proxyKey]: path } },
  }
  const format = {
    ...attestation,
    fetchDescriptor: async (descriptorPath: string) => {
      const descriptor = await resolver.fetchDescriptor(descriptorPath)
      return descriptorPath === path ? withDeployment(descriptor, chainId, to) : descriptor
    },
  }
  return { attestation, format }
}
