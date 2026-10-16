import {
  format,
  formatTypedData,
  type DescriptorResolver,
  type DisplayModel,
  type ExternalDataProvider,
  type FormatOptions,
  type Transaction,
  type TypedData,
} from '@ethereum-sourcify/clear-signing'
import { useEffect } from 'react'
import { ERC7730_REGISTRY_URL } from '@/config/constants.extra'
import { useClearSigningLookupContext, type ClearSigningLookupResultData } from './ClearSigningLookupContext'
import { assertClearSigningModelLoaded, shouldShowClearSigningModel } from './descriptorModel'
import { getRegistryResolver } from './registryResolver'

export type ClearSigningFormatInput<T> = (input: T, options: FormatOptions) => Promise<DisplayModel>

export const formatCalldataInput: ClearSigningFormatInput<Transaction> = format

export const formatTypedDataInput: ClearSigningFormatInput<TypedData> = formatTypedData

const trackFetchedDescriptors = (resolver: DescriptorResolver, fetchedPaths: string[]): DescriptorResolver => ({
  ...resolver,
  fetchDescriptor: (path) => {
    fetchedPaths.push(path)
    return resolver.fetchDescriptor(path)
  },
})

export const formatWithRegistry = async <T>(
  input: T,
  externalDataProvider: ExternalDataProvider,
  formatInput: ClearSigningFormatInput<T>,
): Promise<ClearSigningLookupResultData> => {
  const resolver = await getRegistryResolver(ERC7730_REGISTRY_URL)
  const fetchedPaths: string[] = []
  const model = assertClearSigningModelLoaded(
    await formatInput(input, {
      externalDataProvider,
      descriptorResolverOptions: { type: 'custom', resolver: trackFetchedDescriptors(resolver, fetchedPaths) },
    }),
  )

  return { model: shouldShowClearSigningModel(model) ? model : undefined, descriptorPath: fetchedPaths[0] }
}

interface ClearSigningLookupParams<T> {
  lookupKey: string
  label: string
  isEligible: boolean
  input: T | undefined
  formatInput: ClearSigningFormatInput<T>
}

export interface ClearSigningLookupResult {
  isActive: boolean
  loading: boolean
  error: Error | undefined
  model: DisplayModel | undefined
  descriptorPath: string | undefined
}

export const useClearSigningLookup = <T>({
  lookupKey,
  label,
  isEligible,
  input,
  formatInput,
}: ClearSigningLookupParams<T>): ClearSigningLookupResult => {
  const lookupContext = useClearSigningLookupContext()
  const registerEntry = lookupContext?.registerEntry
  const subscribeEntry = lookupContext?.subscribeEntry

  useEffect(() => {
    if (!lookupKey || !registerEntry) {
      return
    }
    const run = input
      ? (externalDataProvider: ExternalDataProvider) => formatWithRegistry(input, externalDataProvider, formatInput)
      : undefined
    registerEntry(lookupKey, { label, eligible: isEligible && run !== undefined, run })
  }, [lookupKey, label, isEligible, input, formatInput, registerEntry])

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
  }
}
