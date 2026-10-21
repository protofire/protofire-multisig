import {
  attestationPathForDescriptor,
  type Descriptor,
  type DescriptorResolver,
  type OffchainAttestation,
  type RegistryIndex,
} from '@ethereum-sourcify/clear-signing'
import { getOrCreate } from './promiseCache'

const CALLDATA_INDEX_FILE = 'index.calldata.json'
const TYPED_DATA_INDEX_FILE = 'index.eip712.json'
const FETCH_TIMEOUT_MS = 10_000

const resolverPromises = new Map<string, Promise<DescriptorResolver>>()

const fetchRegistryResponse = (baseUrl: string, path: string): Promise<Response> =>
  fetch(`${baseUrl}/${path}`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })

const parseRegistryFile = <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching ${response.url}`)
  }
  return response.json()
}

const fetchRegistryFile = async <T>(baseUrl: string, path: string): Promise<T> =>
  parseRegistryFile<T>(await fetchRegistryResponse(baseUrl, path))

export const fetchOptionalRegistryFile = async <T>(baseUrl: string, path: string): Promise<T | null> => {
  const response = await fetchRegistryResponse(baseUrl, path)
  return response.status === 404 ? null : parseRegistryFile<T>(response)
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isCalldataIndex = (value: unknown): value is RegistryIndex['calldataIndex'] =>
  isRecord(value) && Object.values(value).every((path) => typeof path === 'string')

const isTypedDataIndex = (value: unknown): value is RegistryIndex['typedDataIndex'] =>
  isRecord(value) && Object.values(value).every(isRecord)

const createRegistryResolver = async (baseUrl: string): Promise<DescriptorResolver> => {
  const [calldataIndex, typedDataIndex] = await Promise.all([
    fetchRegistryFile<unknown>(baseUrl, CALLDATA_INDEX_FILE),
    fetchRegistryFile<unknown>(baseUrl, TYPED_DATA_INDEX_FILE),
  ])
  if (!isCalldataIndex(calldataIndex) || !isTypedDataIndex(typedDataIndex)) {
    throw new Error(`Malformed ERC-7730 registry index at ${baseUrl}`)
  }
  const descriptorPromises = new Map<string, Promise<Descriptor>>()
  const attestationPromises = new Map<string, Promise<OffchainAttestation | null>>()

  return {
    index: { calldataIndex, typedDataIndex },
    fetchDescriptor: (path) =>
      getOrCreate(descriptorPromises, path, () => fetchRegistryFile<Descriptor>(baseUrl, path)),
    fetchAttestation: (descriptorPath, attester) => {
      const path = attestationPathForDescriptor(descriptorPath, attester)
      return getOrCreate(attestationPromises, path, () => fetchOptionalRegistryFile<OffchainAttestation>(baseUrl, path))
    },
  }
}

export const getRegistryResolver = (baseUrl: string): Promise<DescriptorResolver> =>
  getOrCreate(resolverPromises, baseUrl, () => createRegistryResolver(baseUrl))
