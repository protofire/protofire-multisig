import ClearSigningIcon from '@/public/images/common/search.svg'
import CheckIcon from '@/public/images/common/check.svg'
import CloseIcon from '@/public/images/common/close.svg'
import WarningIcon from '@/public/images/notifications/warning.svg'
import { ButtonBase, CircularProgress, Stack, SvgIcon, Typography } from '@mui/material'
import type { ReactElement, ReactNode } from 'react'
import type { ClearSigningLookupEntry, ClearSigningLookupOutcome } from './ClearSigningLookupContext'
import { isRevokedAttestation } from './erc8176/attestation'
import { getClearSigningEntryLabel, getClearSigningFoundCountLabel } from './lookupInputs'
import { useClearSigningLookupSummary } from './ClearSigningLookupContext'
import css from './styles.module.css'

const CompactLookupButton = ({
  label,
  iconComponent,
  disabled = false,
  onClick,
  testId,
}: {
  label: string
  iconComponent: ReactNode
  disabled?: boolean
  onClick?: () => void
  testId?: string
}): ReactElement => (
  <ButtonBase
    className={css.inlineAction}
    data-testid={testId}
    disabled={disabled}
    sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 0.5,
      flexDirection: 'row',
      borderRadius: '8px',
      backgroundColor: 'background.main',
      padding: '4px 16px',
      visibility: 'visible !important',
    }}
    onClick={onClick}
  >
    {iconComponent}
    <Typography variant="subtitle2" fontWeight={700}>
      {label}
    </Typography>
  </ButtonBase>
)

type LookupStatusIcon = { color: 'border' | 'warning' | 'error'; component: typeof CheckIcon }

const WARNING_ICON: LookupStatusIcon = { color: 'warning', component: WarningIcon }

const OUTCOME_ICONS: Record<ClearSigningLookupOutcome, LookupStatusIcon> = {
  found: { color: 'border', component: CheckIcon },
  error: WARNING_ICON,
  not_found: { color: 'error', component: CloseIcon },
}

const getEntryIcon = ({ outcome = 'not_found', attestation }: ClearSigningLookupEntry): LookupStatusIcon =>
  outcome === 'found' && isRevokedAttestation(attestation) ? WARNING_ICON : OUTCOME_ICONS[outcome]

const LookupStatus = ({ icon, label }: { icon: LookupStatusIcon; label: string }): ReactElement => (
  <Stack
    direction="row"
    alignItems="center"
    gap={0.5}
    className={css.inlineAction}
    data-testid="erc7730-queued-lookup-status"
  >
    <SvgIcon {...icon} inheritViewBox sx={{ height: '16px' }} />
    <Typography variant="subtitle2" fontWeight={700}>
      {label}
    </Typography>
  </Stack>
)

export const ClearSigningLookupButton = (): ReactElement | null => {
  const summary = useClearSigningLookupSummary()

  if (!summary) {
    return null
  }

  const { primaryEntry, isMultiAction, isAnyLoading, allDone, foundCount, requestLookups } = summary

  if (isAnyLoading) {
    return (
      <CompactLookupButton
        testId="erc7730-queued-lookup-btn"
        label="Looking up"
        iconComponent={<CircularProgress size={16} />}
        disabled
      />
    )
  }

  if (!isMultiAction && primaryEntry.entry.status === 'done') {
    return (
      <LookupStatus
        icon={getEntryIcon(primaryEntry.entry)}
        label={getClearSigningEntryLabel(primaryEntry.entry) ?? 'Looked up'}
      />
    )
  }

  if (isMultiAction && allDone) {
    return (
      <LookupStatus
        icon={OUTCOME_ICONS[foundCount > 0 ? 'found' : 'not_found']}
        label={getClearSigningFoundCountLabel(foundCount)}
      />
    )
  }

  return (
    <CompactLookupButton
      testId="erc7730-queued-lookup-btn"
      label="ERC-7730 lookup"
      iconComponent={
        <SvgIcon component={ClearSigningIcon} inheritViewBox sx={{ height: '16px', color: 'primary.main' }} />
      }
      onClick={requestLookups}
    />
  )
}
