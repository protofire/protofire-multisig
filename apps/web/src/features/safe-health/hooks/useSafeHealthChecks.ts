import { useMemo } from 'react'
import { SAFE_FEATURES } from '@safe-global/protocol-kit/dist/src/utils/safeVersions'
import { ImplementationVersionState } from '@safe-global/store/gateway/types'
import { sameAddress } from '@safe-global/utils/utils/addresses'
import { getLatestSafeVersion, isNonCriticalUpdate } from '@safe-global/utils/utils/chains'
import { useCurrentChain } from '@/hooks/useChains'
import { MasterCopyDeployer, useMasterCopies } from '@/hooks/useMasterCopies'
import { useHasUntrustedFallbackHandler } from '@/hooks/useHasUntrustedFallbackHandler'
import useSafeInfo from '@/hooks/useSafeInfo'
import {
  useIsRecoveryLoaded,
  useIsRecoverySupported,
  useRecovery,
  useRecoveryDelayModifiersError,
} from '@/features/recovery'
import { hasSafeFeature } from '@/utils/safe-versions'
import {
  getFallbackHandlerCheck,
  getGuardCheck,
  getModulesCheck,
  getOwnersCheck,
  getRecoveryCheck,
  getVersionCheck,
  hasKnownFallbackHandlerList,
  type HealthCheck,
} from '../services/checks'

export const useSafeHealthChecks = (): { checks: HealthCheck[]; hideVersionOnHome: boolean } => {
  const { safe } = useSafeInfo()
  const chain = useCurrentChain()
  const [masterCopies, , masterCopiesLoading] = useMasterCopies()
  const isUntrustedHandler = useHasUntrustedFallbackHandler()
  const supportsRecovery = useIsRecoverySupported()
  const [recovery, recoveryStateError, recoveryStateLoading] = useRecovery()
  const recoveryLoaded = useIsRecoveryLoaded()
  const delayModifiersError = useRecoveryDelayModifiersError()

  return useMemo(() => {
    const masterCopy = masterCopies?.find((mc) => sameAddress(mc.address, safe.implementation.value))
    const isCircles = masterCopiesLoading ? undefined : masterCopy?.deployer === MasterCopyDeployer.CIRCLES
    const recoveryError = recoveryStateError || delayModifiersError
    const recoveryLoading = !recoveryError && (recoveryStateLoading || !recoveryLoaded)
    const recoveryUsable = supportsRecovery && !recoveryError
    const recoveryAddresses = recoveryUsable ? (recovery ?? []).map((item) => item.address) : []

    const checks = [
      getOwnersCheck(safe.owners.length, safe.threshold),
      getVersionCheck(safe.version, getLatestSafeVersion(chain), !!chain, isCircles, safe.implementationVersionState),
      getModulesCheck(safe.modules, recoveryUsable && recoveryLoading ? undefined : recoveryAddresses),
      getGuardCheck(safe.guard, hasSafeFeature(SAFE_FEATURES.SAFE_TX_GUARDS, safe.version)),
      getFallbackHandlerCheck(
        safe.version,
        safe.fallbackHandler,
        isUntrustedHandler,
        hasKnownFallbackHandlerList(safe.chainId),
      ),
      getRecoveryCheck(supportsRecovery, safe.modules, [recovery, recoveryError, recoveryLoading]),
    ]

    // Same rule as OutdatedMastercopyWarning: the Home attention panel already shows this update
    const hideVersionOnHome =
      safe.implementationVersionState === ImplementationVersionState.OUTDATED &&
      !isNonCriticalUpdate(safe.version) &&
      masterCopy?.deployer === MasterCopyDeployer.GNOSIS

    return { checks, hideVersionOnHome }
  }, [
    safe,
    chain,
    masterCopies,
    masterCopiesLoading,
    isUntrustedHandler,
    supportsRecovery,
    recovery,
    recoveryStateError,
    recoveryStateLoading,
    recoveryLoaded,
    delayModifiersError,
  ])
}
