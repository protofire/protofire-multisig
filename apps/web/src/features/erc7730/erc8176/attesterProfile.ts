import { getAddress } from 'ethers'
import { Errors, logError } from '@/services/exceptions'
import { getOrCreate } from '../promiseCache'
import { fetchOptionalRegistryFile, isRecord } from '../registryResolver'
import type { ClearSigningAttestationResult } from './attestation'

export interface AttesterProfile {
  name: string
  organization?: string
  ens?: string
}

const PROFILE_CHAIN_ID = 1

const profilePromises = new Map<string, Promise<AttesterProfile | undefined>>()

const isOptionalString = (value: unknown): value is string | undefined =>
  value === undefined || typeof value === 'string'

const parseProfile = (value: unknown, address: string): AttesterProfile | undefined => {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string') return undefined
  if (value.id.toLowerCase() !== `eip155:${PROFILE_CHAIN_ID}:${address}`.toLowerCase()) return undefined
  if (!isOptionalString(value.organization) || !isOptionalString(value.ens)) return undefined
  return { name: value.name, organization: value.organization, ens: value.ens }
}

const fetchProfile = async (baseUrl: string, address: string): Promise<AttesterProfile | undefined> => {
  const path = `auditors/eip155-${PROFILE_CHAIN_ID}-${address}/profile.json`
  const profile = await fetchOptionalRegistryFile<unknown>(baseUrl, path)
  return parseProfile(profile, address)
}

const getCachedProfile = async (baseUrl: string, attester: string): Promise<AttesterProfile | undefined> => {
  const address = getAddress(attester)
  return getOrCreate(profilePromises, `${baseUrl}/${address}`, () => fetchProfile(baseUrl, address))
}

export const getAttesterProfile = (baseUrl: string, attester: string): Promise<AttesterProfile | undefined> =>
  getCachedProfile(baseUrl, attester).catch((thrown: unknown) => {
    logError(Errors._822, thrown)
    return undefined
  })

export const withAttesterProfile = async (
  baseUrl: string,
  result: ClearSigningAttestationResult,
): Promise<ClearSigningAttestationResult> => {
  const { attestation } = result
  if (attestation?.status !== 'attested') return result
  const profile = await getAttesterProfile(baseUrl, attestation.attester.address)
  if (!profile) return result
  return { ...result, attestation: { ...attestation, attester: { ...attestation.attester, ...profile } } }
}
