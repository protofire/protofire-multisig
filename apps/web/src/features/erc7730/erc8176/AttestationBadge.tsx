import { Stack, Tooltip, Typography } from '@mui/material'
import { formatWithSchema } from '@safe-global/utils/utils/date'
import { shortenAddress } from '@safe-global/utils/utils/formatters'
import classnames from 'classnames'
import type { ReactElement } from 'react'
import ExternalLink from '@/components/common/ExternalLink'
import { getRegistrySourceUrl } from '../descriptorModel'
import { ClearSigningPill } from '../primitives'
import type { ClearSigningAttester } from './attestation'
import css from '../styles.module.css'

const formatDate = (seconds: number): string => formatWithSchema(seconds * 1000, 'MMM d, yyyy')

const getAttestationDates = ({ attestedAt, expiresAt }: ClearSigningAttester): string => {
  const dates: [number | undefined, string][] = [
    [attestedAt, 'Attested'],
    [expiresAt, 'Expires'],
  ]
  return dates.flatMap(([seconds, label]) => (seconds ? [`${label} ${formatDate(seconds)}`] : [])).join(' · ')
}

const getAttesterLabel = ({ organization, name, address }: ClearSigningAttester): string =>
  organization || name || shortenAddress(address)

const getAttesterDetails = ({ name, ens, address }: ClearSigningAttester): string =>
  [name, ens, address].filter(Boolean).join('\n')

export const AttestationBadge = ({ attester }: { attester: ClearSigningAttester }): ReactElement => {
  const dates = getAttestationDates(attester)

  return (
    <Stack direction="row" alignItems="center" flexWrap="wrap" columnGap={1} data-testid="erc8176-attestation-badge">
      <Tooltip title={getAttesterDetails(attester)} arrow slotProps={{ tooltip: { sx: { whiteSpace: 'pre-line' } } }}>
        <span data-testid="erc8176-attester" className={css.chipWrapper}>
          <ClearSigningPill>Reviewed by {getAttesterLabel(attester)}</ClearSigningPill>
        </span>
      </Tooltip>
      {dates && (
        <Typography variant="caption" color="text.secondary" data-testid="erc8176-attestation-dates">
          {dates}
        </Typography>
      )}
      <ExternalLink
        href={getRegistrySourceUrl(attester.attestationPath)}
        data-testid="erc8176-attestation-link"
        className={classnames(css.accent, css.sourceLink)}
      >
        Attestation
      </ExternalLink>
    </Stack>
  )
}
