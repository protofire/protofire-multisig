import { isTronChain } from '@safe-global/utils/utils/chains'
import semverSatisfies from 'semver/functions/satisfies'
import type { SafeVersion } from '@safe-global/types-kit'
import { invariant } from '@safe-global/utils/utils/helpers'
import type { SafeState } from '@safe-global/store/gateway/AUTO_GENERATED/safes'

export const isLegacyVersion = (safeVersion: string): boolean => {
  const LEGACY_VERSION = '<1.3.0'
  return semverSatisfies(safeVersion, LEGACY_VERSION)
}
export const isValidSafeVersion = (safeVersion?: SafeState['version']): safeVersion is SafeVersion => {
  const SAFE_VERSIONS: SafeVersion[] = ['1.4.1', '1.3.0', '1.2.0', '1.1.1', '1.0.0']
  return !!safeVersion && SAFE_VERSIONS.some((version) => semverSatisfies(safeVersion, version))
}

// `assert` does not work with arrow functions
export function assertValidSafeVersion<T extends SafeState['version']>(safeVersion?: T): asserts safeVersion {
  return invariant(isValidSafeVersion(safeVersion), `${safeVersion} is not a valid Safe Account version`)
}

// Protocol Kit 5.x uses the compatible 1.4.1 ABI for the Tron 1.5.0 fork.
// Keep the actual deployed version in Safe state and scope this to contract lookup.
export const getSafeAbiVersion = (safeVersion: SafeState['version'], chainId?: string): SafeState['version'] =>
  chainId !== undefined && isTronChain(chainId) && safeVersion === '1.5.0' ? '1.4.1' : safeVersion
