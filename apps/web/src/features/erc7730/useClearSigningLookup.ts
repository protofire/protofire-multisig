import {
  format,
  formatTypedData,
  resolveCalldataDescriptor,
  resolveTypedDataDescriptor,
  type ChainClient,
  type CustomResolverOptions,
  type DescriptorResolver,
  type DisplayModel,
  type ExternalDataProvider,
  type FormatOptions,
  type Transaction,
  type TypedData,
} from '@ethereum-sourcify/clear-signing'
import { useEffect } from 'react'
import { ERC7730_REGISTRY_URL, ERC8176_TRUSTED_ATTESTERS } from '@/config/constants.extra'
import { Errors, logError } from '@/services/exceptions'
import { useClearSigningLookupContext, type ClearSigningLookupResultData } from './ClearSigningLookupContext'
import { assertClearSigningModelLoaded, shouldShowClearSigningModel } from './descriptorModel'
import {
  resolveAttestation,
  type ClearSigningAttestationResult,
  type ResolveDescriptorResult,
} from './erc8176/attestation'
import { withAttesterProfile } from './erc8176/attesterProfile'
import { getRegistryResolver } from './registryResolver'
import { withSafeSingletonAlias, type ClearSigningResolvers } from './safeSingleton'

export interface ClearSigningInputAdapter<T> {
  format: (input: T, options: FormatOptions) => Promise<DisplayModel>
  resolve: (input: T, options: CustomResolverOptions, chainClient?: ChainClient) => Promise<ResolveDescriptorResult>
  prepareResolvers?: (input: T, resolver: DescriptorResolver) => Promise<ClearSigningResolvers>
}

export const calldataInputAdapter: ClearSigningInputAdapter<Transaction> = {
  format,
  resolve: (tx, options, chainClient) => resolveCalldataDescriptor(tx.chainId, tx.to, options, chainClient),
  prepareResolvers: (tx, resolver) => withSafeSingletonAlias(resolver, tx.chainId, tx.to),
}

export const typedDataInputAdapter: ClearSigningInputAdapter<TypedData> = {
  format: formatTypedData,
  resolve: resolveTypedDataDescriptor,
}

export const formatWithRegistry = async <T>(
  input: T,
  externalDataProvider: ExternalDataProvider,
  adapter: ClearSigningInputAdapter<T>,
): Promise<ClearSigningLookupResultData> => {
  const registryResolver = await getRegistryResolver(ERC7730_REGISTRY_URL)
  const resolvers = adapter.prepareResolvers
    ? await adapter.prepareResolvers(input, registryResolver)
    : { attestation: registryResolver, format: registryResolver }
  const [attestation, formatted] = await Promise.all([
    resolveAttestation({
      resolver: resolvers.attestation,
      chainClient: externalDataProvider.chainClient,
      trustedAttesters: ERC8176_TRUSTED_ATTESTERS,
      resolve: (options, chainClient) => adapter.resolve(input, options, chainClient),
      onFailure: (thrown) => logError(Errors._821, thrown),
    }).then((result) => withAttesterProfile(ERC7730_REGISTRY_URL, result)),
    adapter.format(input, {
      externalDataProvider,
      descriptorResolverOptions: { type: 'custom', resolver: resolvers.format },
    }),
  ])
  const model = assertClearSigningModelLoaded(formatted)

  return { ...attestation, model: shouldShowClearSigningModel(model) ? model : undefined }
}

interface ClearSigningLookupParams<T> {
  lookupKey: string
  label: string
  isEligible: boolean
  input: T | undefined
  adapter: ClearSigningInputAdapter<T>
}

export interface ClearSigningLookupResult extends ClearSigningAttestationResult {
  isActive: boolean
  loading: boolean
  error: Error | undefined
  model: DisplayModel | undefined
}

export const useClearSigningLookup = <T>({
  lookupKey,
  label,
  isEligible,
  input,
  adapter,
}: ClearSigningLookupParams<T>): ClearSigningLookupResult => {
  const lookupContext = useClearSigningLookupContext()
  const registerEntry = lookupContext?.registerEntry
  const subscribeEntry = lookupContext?.subscribeEntry

  useEffect(() => {
    if (!lookupKey || !registerEntry) {
      return
    }
    const run = input
      ? (externalDataProvider: ExternalDataProvider) => formatWithRegistry(input, externalDataProvider, adapter)
      : undefined
    registerEntry(lookupKey, { label, eligible: isEligible && run !== undefined, run })
  }, [lookupKey, label, isEligible, input, adapter, registerEntry])

  useEffect(() => {
    if (!lookupKey || !subscribeEntry) {
      return
    }
    return subscribeEntry(lookupKey)
  }, [lookupKey, subscribeEntry])

  const entry = lookupKey ? lookupContext?.entries[lookupKey] : undefined
  const isActive = entry !== undefined && isEligible && entry.status !== 'idle'

  return {
    isActive,
    loading: entry?.status === 'loading',
    error: entry?.error,
    model: entry?.model,
    descriptorPath: entry?.descriptorPath,
    attestation: entry?.attestation,
  }
}
