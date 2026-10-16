import { Typography } from '@mui/material'
import { ErrorBoundary } from '@sentry/react'
import type { ReactElement, ReactNode } from 'react'
import { ClearSigningPanel } from './ClearSigningPanel'
import type { ClearSigningLookupResult } from './useClearSigningLookup'

type ClearSigningSubject = 'call' | 'message'

const getStatusCopy = (subject: ClearSigningSubject) => ({
  loading: 'Looking up ERC-7730 descriptor…',
  error: `ERC-7730 lookup unavailable for this ${subject}`,
  notFound: `No ERC-7730 descriptor found for this ${subject}`,
})

const StatusText = ({ children }: { children: string }): ReactElement => (
  <Typography variant="body2" color="text.secondary" data-testid="erc7730-check-status">
    {children}
  </Typography>
)

export const ClearSigningLookupStatusView = ({
  lookup: { isActive, loading, error, model, descriptorPath },
  subject,
}: {
  lookup: ClearSigningLookupResult
  subject: ClearSigningSubject
}): ReactElement | null => {
  if (!isActive) {
    return null
  }

  const copy = getStatusCopy(subject)

  if (loading) {
    return <StatusText>{copy.loading}</StatusText>
  }

  if (error) {
    return <StatusText>{copy.error}</StatusText>
  }

  if (!model) {
    return <StatusText>{copy.notFound}</StatusText>
  }

  return <ClearSigningPanel model={model} descriptorPath={descriptorPath} />
}

export const ClearSigningBoundary = ({
  subject,
  children,
}: {
  subject: ClearSigningSubject
  children: ReactNode
}): ReactElement => (
  <ErrorBoundary fallback={<StatusText>{getStatusCopy(subject).error}</StatusText>}>{children}</ErrorBoundary>
)
