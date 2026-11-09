import type { ReactElement } from 'react'
import { useMemo } from 'react'
import { Box } from '@mui/material'
import { useSafenetCheck } from '@safe-global/utils/features/safenet-checks/hooks'
import { safenetExplorerTxUrl } from '@safe-global/utils/features/safenet-checks/utils/safenetExplorerTxUrl'
import { SAFENET_PROXY_URL } from '@safe-global/utils/features/safenet-checks/constants'
import { CheckStatus } from '@safe-global/utils/features/safenet-checks/types/status'
import { useRequestSafenetCheck } from '../../hooks/useRequestSafenetCheck'
import SafenetCheckStatus, { type RequestState } from './SafenetCheckStatus'

export type SafenetCheckSectionProps = {
  safeTxHash: string
  chainId: string
  safeAddress: string
  submittedAt?: number
  canRequestCheck?: boolean
}

const SafenetCheckSection = ({
  safeTxHash,
  chainId,
  safeAddress,
  submittedAt,
  canRequestCheck = true,
}: SafenetCheckSectionProps): ReactElement | null => {
  const target = useMemo(() => ({ chainId, safeAddress }), [chainId, safeAddress])
  const { publicStatus, unavailableReason, isStale, isRequested } = useSafenetCheck(safeTxHash, submittedAt, target)
  const { request, state } = useRequestSafenetCheck({ chainId, safeAddress, safeTxHash })

  const requestState: RequestState = isRequested ? 'requested' : state
  const isUnavailable = publicStatus === CheckStatus.UNAVAILABLE

  if (!canRequestCheck && isUnavailable && unavailableReason !== 'READ_FAILED' && !isRequested) return null

  return (
    <Box data-testid="safenet-check-section" mt={2}>
      <SafenetCheckStatus
        status={publicStatus}
        unavailableReason={unavailableReason}
        isStale={isStale}
        explorerUrl={isUnavailable ? undefined : safenetExplorerTxUrl(chainId, safeTxHash)}
        onRequestCheck={SAFENET_PROXY_URL && canRequestCheck ? request : undefined}
        requestState={requestState}
      />
    </Box>
  )
}

export default SafenetCheckSection
