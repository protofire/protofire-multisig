import {
  CheckStatus,
  type PublicCheckStatus,
  type UnavailableReason,
} from '@safe-global/utils/features/safenet-checks/types/status'

type Severity = 'success' | 'error' | 'warning' | 'info'

export type StatusCopy = { severity: Severity; title: string; description: string; chip: string }

const STATUS_COPY: Record<Exclude<PublicCheckStatus, CheckStatus.UNAVAILABLE>, StatusCopy> = {
  [CheckStatus.SUBMITTED]: {
    severity: 'info',
    chip: 'Submitted',
    title: 'Check submitted',
    description: 'Proposed to Safenet. Sentinels have not started voting yet.',
  },
  [CheckStatus.IN_PROGRESS]: {
    severity: 'info',
    chip: 'In progress',
    title: 'Check in progress',
    description: 'Sentinels are voting. A verdict usually lands within a few minutes.',
  },
  [CheckStatus.BENIGN]: {
    severity: 'success',
    chip: 'Verified',
    title: 'Verified by Safenet',
    description: 'Sentinels approved the transaction and validators attested to it.',
  },
  [CheckStatus.MALICIOUS]: {
    severity: 'error',
    chip: 'Denied',
    title: 'Denied by Safenet',
    description: 'Sentinels denied this transaction. It will not be attested.',
  },
  [CheckStatus.DISPUTED]: {
    severity: 'warning',
    chip: 'Disputed',
    title: 'Under arbitration',
    description: 'Sentinels disagreed. The Security Council decides, and the transaction will not be attested.',
  },
  [CheckStatus.TIMED_OUT]: {
    severity: 'warning',
    chip: 'Timed out',
    title: 'Check timed out',
    description: 'No verdict arrived before the deadline, so Safenet could not vouch for this transaction.',
  },
}

const UNAVAILABLE_COPY: Record<UnavailableReason, StatusCopy> = {
  NO_CHECK: {
    severity: 'info',
    chip: 'Not checked',
    title: 'Not checked by Safenet',
    description: 'This transaction has not been proposed to Safenet.',
  },
  WINDOW_UNCERTAIN: {
    severity: 'info',
    chip: 'Unknown',
    title: 'Status unknown',
    description: "We couldn't confirm whether Safenet checked this transaction.",
  },
  READ_FAILED: {
    severity: 'warning',
    chip: 'Unavailable',
    title: 'Could not read status',
    description: 'The Safenet chain read failed. Try again in a moment.',
  },
}

export const getStatusCopy = (
  status: PublicCheckStatus,
  unavailableReason: UnavailableReason | undefined,
): StatusCopy | undefined => {
  if (status !== CheckStatus.UNAVAILABLE) return STATUS_COPY[status]
  return unavailableReason ? UNAVAILABLE_COPY[unavailableReason] : undefined
}
