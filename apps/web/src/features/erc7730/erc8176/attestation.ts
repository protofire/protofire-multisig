import {
  attestationPathForDescriptor,
  type ChainClient,
  type CustomResolverOptions,
  type DescriptorResolver,
  type OffchainAttestation,
  type resolveCalldataDescriptor,
} from '@ethereum-sourcify/clear-signing'

export type ClearSigningAttestationStatus = 'attested' | 'revoked' | 'unattested'

export interface ClearSigningAttester {
  address: string
  name?: string
  organization?: string
  ens?: string
  attestedAt?: number
  expiresAt?: number
  attestationPath: string
}

export type ClearSigningRevokedAttestation = { status: 'revoked' }

export type ClearSigningAttestation =
  | { status: 'attested'; attester: ClearSigningAttester }
  | ClearSigningRevokedAttestation
  | { status: 'unattested' }

export const REVOKED_WARNING = {
  label: 'revoked',
  tooltip: 'the auditor revoked its attestation',
  message: 'The auditor revoked their attestation for this descriptor. Review the details below with caution.',
}

export const UNATTESTED_COPY = 'This version of the descriptor is not reviewed by a trusted auditor yet'

export const isRevokedAttestation = (
  attestation: ClearSigningAttestation | undefined,
): attestation is ClearSigningRevokedAttestation => attestation?.status === 'revoked'

export interface ClearSigningAttestationResult {
  descriptorPath?: string
  attestation?: ClearSigningAttestation
}

export type ResolveDescriptorResult = Awaited<ReturnType<typeof resolveCalldataDescriptor>>

export type ResolveDescriptor = (
  options: CustomResolverOptions,
  chainClient: ChainClient | undefined,
) => Promise<ResolveDescriptorResult>

export interface ResolveAttestationOptions {
  resolver: DescriptorResolver
  chainClient: ChainClient | undefined
  trustedAttesters: string[]
  resolve: ResolveDescriptor
  onFailure?: (thrown: unknown) => void
}

interface AttesterCheck {
  attester: string | undefined
  descriptorPath?: string
  attestation?: OffchainAttestation | null
  revoked: boolean
  resolved?: ResolveDescriptorResult
}

const BYTES32 = /^0x[0-9a-fA-F]{64}$/

const STATUS_PRECEDENCE: ClearSigningAttestationStatus[] = ['attested', 'revoked', 'unattested']

const ATTESTATION_WARNING_CODES = new Set(['ATTESTATION_OPTIONS_INCOMPLETE', 'NO_TRUSTED_ATTESTATION'])

const toSeconds = (value: string | number | undefined): number | undefined => {
  const seconds = Number(value)
  return Number.isFinite(seconds) && seconds > 0 ? seconds : undefined
}

const toAttester = (
  descriptorPath: string,
  address: string,
  attestation: OffchainAttestation,
): ClearSigningAttester => ({
  address,
  attestedAt: toSeconds(attestation.sig?.message?.time),
  expiresAt: toSeconds(attestation.sig?.message?.expirationTime),
  attestationPath: attestationPathForDescriptor(descriptorPath, address),
})

const isRevokedResult = (result: string): boolean => BYTES32.test(result) && BigInt(result) !== 0n

const isDefined = <T>(value: T | undefined): value is T => value !== undefined

const deriveRejected = (check: AttesterCheck, code: string): ClearSigningAttestation | undefined =>
  ATTESTATION_WARNING_CODES.has(code) ? { status: check.revoked ? 'revoked' : 'unattested' } : undefined

const deriveAttested = (check: AttesterCheck, descriptorPath: string): ClearSigningAttestation | undefined =>
  check.attester && check.attestation
    ? { status: 'attested', attester: toAttester(descriptorPath, check.attester, check.attestation) }
    : undefined

const deriveCheck = (check: AttesterCheck, descriptorPath: string): ClearSigningAttestation | undefined => {
  if (!check.resolved) return { status: 'unattested' }
  if (!('warning' in check.resolved)) return deriveAttested(check, descriptorPath)
  return deriveRejected(check, check.resolved.warning.code)
}

const pickByPrecedence = (attestations: ClearSigningAttestation[]): ClearSigningAttestation | undefined =>
  STATUS_PRECEDENCE.map((status) => attestations.find((attestation) => attestation.status === status)).find(isDefined)

const deriveResult = (checks: AttesterCheck[]): ClearSigningAttestationResult => {
  const descriptorPath = checks.map((check) => check.descriptorPath).find(isDefined)
  if (!descriptorPath) return {}
  const attestations = checks.map((check) => deriveCheck(check, descriptorPath)).filter(isDefined)
  return { descriptorPath, attestation: pickByPrecedence(attestations) }
}

export const resolveAttestation = async ({
  resolver,
  chainClient,
  trustedAttesters,
  resolve,
  onFailure,
}: ResolveAttestationOptions): Promise<ClearSigningAttestationResult> => {
  const networkErrors = new Set<unknown>()
  const { fetchAttestation } = resolver

  const trackNetworkFailure = <T>(promise: Promise<T>): Promise<T> =>
    promise.catch((thrown: unknown): never => {
      networkErrors.add(thrown)
      throw thrown
    })

  const trackResolver = (check: AttesterCheck): DescriptorResolver => ({
    ...resolver,
    fetchDescriptor: async (path) => {
      const descriptor = await trackNetworkFailure(resolver.fetchDescriptor(path))
      check.descriptorPath ??= path
      return descriptor
    },
    fetchAttestation:
      fetchAttestation &&
      (async (path, attester) => {
        check.attestation = await trackNetworkFailure(fetchAttestation(path, attester))
        return check.attestation
      }),
  })

  const trackChainClient = (check: AttesterCheck): ChainClient | undefined =>
    chainClient && {
      call: async (chainId, request) => {
        const result = await trackNetworkFailure(chainClient.call(chainId, request))
        check.revoked ||= isRevokedResult(result)
        return result
      },
    }

  const reportFailure = (check: AttesterCheck, thrown: unknown): undefined => {
    if (check.descriptorPath && !networkErrors.has(thrown)) onFailure?.(thrown)
    return undefined
  }

  const checkAttester = async (attester: string | undefined): Promise<AttesterCheck> => {
    const check: AttesterCheck = { attester, revoked: false }
    const options: CustomResolverOptions = {
      type: 'custom',
      resolver: trackResolver(check),
      attestations: { trustedAttesters: attester ? [attester] : [] },
    }
    check.resolved = await resolve(options, trackChainClient(check)).catch((thrown: unknown) =>
      reportFailure(check, thrown),
    )
    return check
  }

  const attesters = trustedAttesters.length > 0 ? trustedAttesters : [undefined]
  return deriveResult(await Promise.all(attesters.map(checkAttester)))
}
