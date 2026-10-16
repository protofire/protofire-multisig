import { useEffect, type ReactElement } from 'react'
import { SafeShieldDisplay } from './components/SafeShieldDisplay'
import { useSafeShield } from './SafeShieldContext'
import { SAFE_SHIELD_EVENTS, trackEvent } from '@/services/analytics'
import { useHypernativeOAuth, useIsHypernativeEligible } from '@/features/hypernative'
import { useHasFeature } from '@/hooks/useChains'
import { FEATURES } from '@safe-global/utils/utils/chains'

const SafeShieldWidget = (): ReactElement | null => {
  const { recipient, contract, threat, safeTx, safeAnalysis, addToTrustedList } = useSafeShield()
  const hypernativeAuth = useHypernativeOAuth()
  const { isHypernativeEligible, isHypernativeGuard, loading: eligibilityLoading } = useIsHypernativeEligible()
  const showHnInfo = !eligibilityLoading && isHypernativeEligible
  const showHnActiveStatus = !eligibilityLoading && isHypernativeGuard
  const isTron = useHasFeature(FEATURES.TRON) === true

  // Track when a transaction flow is started
  useEffect(() => {
    if (!isTron) {
      trackEvent(SAFE_SHIELD_EVENTS.TRANSACTION_STARTED)
    }
  }, [isTron])

  // Safe Shield analysis is not available on Tron chains
  if (isTron) return null

  return (
    <SafeShieldDisplay
      data-testid="safe-shield-widget"
      recipient={recipient}
      contract={contract}
      threat={threat}
      safeTx={safeTx}
      hypernativeAuth={!eligibilityLoading && isHypernativeEligible ? hypernativeAuth : undefined}
      showHypernativeInfo={showHnInfo}
      showHypernativeActiveStatus={showHnActiveStatus}
      safeAnalysis={safeAnalysis}
      onAddToTrustedList={addToTrustedList}
    />
  )
}

export default SafeShieldWidget
