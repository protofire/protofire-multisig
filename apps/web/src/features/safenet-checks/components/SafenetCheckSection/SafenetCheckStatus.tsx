import type { ReactElement } from 'react'
import { Alert, Box, Button, Chip, CircularProgress, Skeleton, Stack, Typography } from '@mui/material'
import ExternalLink from '@/components/common/ExternalLink'
import {
  CheckStatus,
  type PublicCheckStatus,
  type UnavailableReason,
} from '@safe-global/utils/features/safenet-checks/types/status'
import { getStatusCopy, type StatusCopy } from '../../statusCopy'

const REQUESTED_COPY = {
  title: 'Check requested',
  description: 'The proxy is proposing it to Safenet. The status updates here once the proposal lands.',
}

export type RequestState = 'idle' | 'requesting' | 'requested' | 'failed' | 'underfunded'

const FAILURE_COPY: Partial<Record<RequestState, string>> = {
  failed: 'The request failed. Check that the Safenet proxy is running and try again.',
  underfunded:
    "Safenet can't take this check right now because the sponsor is out of funds. Try again once it is topped up.",
}

export type SafenetCheckStatusProps = {
  status: PublicCheckStatus
  unavailableReason: UnavailableReason | undefined
  isStale: boolean
  explorerUrl?: string
  onRequestCheck?: () => void
  requestState?: RequestState
}

const linkSx = { textDecoration: 'underline', display: 'inline-flex', alignSelf: 'flex-start' } as const

const Header = ({ copy, isUnavailable }: { copy: StatusCopy | undefined; isUnavailable: boolean }): ReactElement => (
  <Box display="flex" alignItems="center" justifyContent="space-between" mb={0.5}>
    <Typography variant="overline" color="text.secondary">
      Safenet
    </Typography>
    {copy && (
      <Chip
        size="small"
        label={copy.chip}
        color={copy.severity === 'info' && isUnavailable ? 'default' : copy.severity}
        variant="outlined"
      />
    )}
  </Box>
)

const RequestCheck = ({
  onRequestCheck,
  requestState,
}: Required<Pick<SafenetCheckStatusProps, 'onRequestCheck' | 'requestState'>>): ReactElement => (
  <Stack gap={0.5} alignItems="flex-start">
    <Button
      size="small"
      variant="contained"
      onClick={onRequestCheck}
      disabled={requestState === 'requesting'}
      startIcon={requestState === 'requesting' ? <CircularProgress size={14} color="inherit" /> : undefined}
      data-testid="safenet-request-check"
      sx={{ whiteSpace: 'nowrap' }}
    >
      {requestState === 'requesting' ? 'Requesting' : 'Request Safenet check'}
    </Button>
    {FAILURE_COPY[requestState] ? (
      <Typography variant="caption" color="error">
        {FAILURE_COPY[requestState]}
      </Typography>
    ) : (
      <Typography variant="caption" color="text.secondary">
        The check fee is paid by the sponsor.
      </Typography>
    )}
  </Stack>
)

const SafenetCheckStatus = ({
  status,
  unavailableReason,
  isStale,
  explorerUrl,
  onRequestCheck,
  requestState = 'idle',
}: SafenetCheckStatusProps): ReactElement => {
  const copy = getStatusCopy(status, unavailableReason)
  const isUnavailable = status === CheckStatus.UNAVAILABLE

  if (!copy) {
    return (
      <>
        <Header copy={copy} isUnavailable={isUnavailable} />
        <Box data-testid="safenet-check-loading">
          <Skeleton variant="rounded" height={72} />
        </Box>
      </>
    )
  }

  const isRequested = isUnavailable && requestState === 'requested'
  const canRequest = isUnavailable && onRequestCheck !== undefined && !isRequested
  const isAwaitingProposal = isRequested && unavailableReason !== 'READ_FAILED'
  const isWaiting = status === CheckStatus.SUBMITTED || status === CheckStatus.IN_PROGRESS || isAwaitingProposal
  const { title, description } = isAwaitingProposal ? REQUESTED_COPY : copy

  return (
    <>
      <Header copy={copy} isUnavailable={isUnavailable} />
      <Alert
        severity={copy.severity}
        icon={isWaiting ? <CircularProgress size={20} color="inherit" /> : undefined}
        data-testid="safenet-check-status"
        sx={{ '& .MuiAlert-message': { width: '100%' } }}
      >
        <Stack gap={1}>
          <Typography variant="body2" fontWeight="bold">
            {title}
          </Typography>

          <Typography variant="body2" color="text.secondary">
            {description}
          </Typography>

          {isStale && (
            <Typography variant="caption" color="text.secondary">
              Showing the last known status. The latest read failed.
            </Typography>
          )}

          {explorerUrl && (
            <ExternalLink href={explorerUrl} sx={linkSx}>
              <Typography variant="body2" fontWeight="bold">
                View on Safenet Explorer
              </Typography>
            </ExternalLink>
          )}

          {canRequest && <RequestCheck onRequestCheck={onRequestCheck} requestState={requestState} />}
        </Stack>
      </Alert>
    </>
  )
}

export default SafenetCheckStatus
