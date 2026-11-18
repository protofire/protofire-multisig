import semverSatisfies from 'semver/functions/satisfies'
import semverValid from 'semver/functions/valid'
import { getCompatibilityFallbackHandlerDeployments } from '@safe-global/safe-deployments'
import type { AddressInfo, SafeState } from '@safe-global/store/gateway/AUTO_GENERATED/safes'
import type { AsyncResult } from '@safe-global/utils/hooks/useAsync'
import { isValidMasterCopy } from '@safe-global/utils/services/contracts/safeContracts'
import { sameAddress } from '@safe-global/utils/utils/addresses'
import { isNonCriticalUpdate, MIN_SAFE_VERSION } from '@safe-global/utils/utils/chains'
import { maybePlural, shortenAddress } from '@safe-global/utils/utils/formatters'

export type CheckId = 'owners' | 'version' | 'modules' | 'guard' | 'fallbackHandler' | 'recovery'
export type CheckStatus = 'ok' | 'info' | 'loading'

export type HealthCheck = {
  id: CheckId
  // Stable key. It is also the analytics label.
  state: string
  status: CheckStatus
  title: string
  summary: string
  detail?: string
  items?: AddressInfo[]
}

const FALLBACK_HANDLER_MIN_VERSION = '>=1.1.1'
const KNOWN_HANDLER_VERSIONS = '>=1.3.0 <1.5.0'

const displayName = (info: AddressInfo): string => info.name || shortenAddress(info.value)

export const getOwnersCheck = (owners: number, threshold: number): HealthCheck => {
  const base = { id: 'owners', title: 'Signers and threshold' } as const
  const summary = `${threshold} out of ${owners} signer${maybePlural(owners)} must confirm`

  if (owners === 1) {
    return {
      ...base,
      state: 'one_of_one',
      status: 'info',
      summary,
      detail: 'Add a signer so you keep access if this key is lost.',
    }
  }
  if (threshold === 1) {
    return {
      ...base,
      state: 'one_of_n',
      status: 'info',
      summary,
      detail:
        'Use a threshold higher than one to prevent losing access to your Safe Account in case a signer key is lost or compromised.',
    }
  }
  if (threshold === owners) {
    return {
      ...base,
      state: 'n_of_n',
      status: 'info',
      summary,
      detail:
        'Use a threshold which is lower than the total number of signers of your Safe Account in case a signer loses access to their account and needs to be replaced.',
    }
  }
  return { ...base, state: 'ok', status: 'ok', summary }
}

export const getVersionCheck = (
  version: string | null | undefined,
  latest: string,
  chainLoaded: boolean,
  // undefined while the mastercopy list is loading
  isCircles: boolean | undefined,
  implementationState: SafeState['implementationVersionState'],
): HealthCheck => {
  const base = { id: 'version', title: 'Contract version' } as const

  // version comes from the contract's own VERSION(), so a non-official mastercopy can claim any version
  if (!isValidMasterCopy(implementationState)) {
    return {
      ...base,
      state: 'unsupported',
      status: 'info',
      summary: 'Unsupported contract version',
      detail: 'This Safe Account does not run an official Safe contract.',
    }
  }
  if (!version || !semverValid(version)) {
    return { ...base, state: 'not_recognised', status: 'info', summary: 'Contract version not recognised' }
  }
  if (!chainLoaded) {
    return { ...base, state: 'could_not_check', status: 'info', summary: 'Could not check the contract version' }
  }
  if (isCircles === undefined) {
    return { ...base, state: 'loading', status: 'loading', summary: 'Checking…' }
  }
  if (isCircles) {
    return { ...base, state: 'circles', status: 'ok', summary: `Version ${version}` }
  }
  if (semverSatisfies(version, `>=${latest}`)) {
    return { ...base, state: 'up_to_date', status: 'ok', summary: `Version ${version}, up to date` }
  }
  if (isNonCriticalUpdate(version)) {
    return {
      ...base,
      state: 'update_available',
      status: 'ok',
      summary: `Version ${version}`,
      detail: `Version ${latest} is available, optional.`,
    }
  }
  return {
    ...base,
    state: 'below_min',
    status: 'info',
    summary: `Version ${version}`,
    detail: `Versions before ${MIN_SAFE_VERSION} miss newer features. Version ${latest} is available.`,
  }
}

export const getModulesCheck = (
  modules: AddressInfo[] | null | undefined,
  // undefined while recovery is loading
  recoveryAddresses: string[] | undefined,
): HealthCheck => {
  const base = { id: 'modules', title: 'Safe modules' } as const
  const list = modules ?? []
  const count = `${list.length} module${maybePlural(list)}`

  if (list.length === 0) {
    return { ...base, state: 'none', status: 'ok', summary: 'No Safe modules enabled' }
  }
  if (!recoveryAddresses) {
    return { ...base, state: 'loading', status: 'loading', summary: 'Checking…' }
  }
  if (list.every((module) => recoveryAddresses.some((address) => sameAddress(address, module.value)))) {
    return { ...base, state: 'recovery_only', status: 'ok', summary: `${count}: Account recovery` }
  }
  return { ...base, state: 'listed', status: 'info', summary: `${count} enabled`, items: list }
}

export const getGuardCheck = (guard: AddressInfo | null | undefined, supportsGuards: boolean): HealthCheck => {
  const base = { id: 'guard', title: 'Transaction guard' } as const

  if (guard) {
    return { ...base, state: 'listed', status: 'info', summary: `Guard: ${displayName(guard)}`, items: [guard] }
  }
  if (!supportsGuards) {
    return { ...base, state: 'not_supported', status: 'info', summary: 'Not supported by this version' }
  }
  return { ...base, state: 'none', status: 'ok', summary: 'No transaction guard set' }
}

export const hasKnownFallbackHandlerList = (chainId: string): boolean =>
  ['1.3.0', '1.4.1'].some(
    (version) => !!getCompatibilityFallbackHandlerDeployments({ network: chainId, version })?.networkAddresses[chainId],
  )

export const getFallbackHandlerCheck = (
  version: string | null | undefined,
  handler: AddressInfo | null | undefined,
  isUntrusted: boolean,
  hasKnownList: boolean,
): HealthCheck => {
  const base = { id: 'fallbackHandler', title: 'Fallback handler' } as const

  if (version && semverValid(version) && !semverSatisfies(version, FALLBACK_HANDLER_MIN_VERSION)) {
    return { ...base, state: 'not_supported', status: 'info', summary: 'Not supported by this version' }
  }
  if (!handler) {
    return { ...base, state: 'none', status: 'info', summary: 'No fallback handler set' }
  }
  if (!isUntrusted) {
    return { ...base, state: 'known', status: 'ok', summary: handler.name || 'Known handler' }
  }
  if (!version || !semverSatisfies(version, KNOWN_HANDLER_VERSIONS) || !hasKnownList) {
    return { ...base, state: 'could_not_verify', status: 'info', summary: 'Could not verify this handler' }
  }
  return { ...base, state: 'not_in_list', status: 'info', summary: 'Not in our list of known handlers' }
}

export const getRecoveryCheck = (
  supported: boolean,
  modules: AddressInfo[] | null | undefined,
  [data, error, loading]: AsyncResult<{ address: string; delay: bigint }[]>,
): HealthCheck => {
  const base = { id: 'recovery', title: 'Account recovery' } as const

  if (!supported) {
    return { ...base, state: 'not_available', status: 'info', summary: 'Not available on this network' }
  }
  if (!modules?.length) {
    return { ...base, state: 'no_modules', status: 'info', summary: 'Not set up' }
  }
  if (loading) {
    return { ...base, state: 'loading', status: 'loading', summary: 'Checking…' }
  }
  if (error) {
    return { ...base, state: 'could_not_check', status: 'info', summary: 'Could not check' }
  }
  const matches = (data ?? []).filter((item) => modules.some((module) => sameAddress(item.address, module.value)))

  if (matches.length === 0) {
    return { ...base, state: 'not_found', status: 'info', summary: 'No recovery module found' }
  }
  if (matches.some((item) => item.delay === 0n)) {
    return {
      ...base,
      state: 'no_delay',
      status: 'info',
      summary: 'Set up without a review period',
      detail: 'A Recoverer can take control of this Safe Account right away.',
    }
  }
  return { ...base, state: 'set_up', status: 'ok', summary: 'Set up' }
}
