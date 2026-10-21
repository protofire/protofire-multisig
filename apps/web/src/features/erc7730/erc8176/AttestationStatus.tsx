import { Alert, Typography } from '@mui/material'
import type { ReactElement } from 'react'
import { FieldGrid } from '../primitives'
import { isRevokedAttestation, REVOKED_WARNING, UNATTESTED_COPY, type ClearSigningAttestation } from './attestation'
import { AttestationBadge } from './AttestationBadge'
import css from '../styles.module.css'

export const AttestationWarning = ({
  attestation,
}: {
  attestation: ClearSigningAttestation | undefined
}): ReactElement | null => {
  if (!isRevokedAttestation(attestation)) return null
  return (
    <Alert severity="warning" className={css.warnings} data-testid="erc8176-status-revoked">
      <Typography variant="body2" component="div">
        {REVOKED_WARNING.message}
      </Typography>
    </Alert>
  )
}

export const AttestationStatus = ({
  attestation,
}: {
  attestation: ClearSigningAttestation | undefined
}): ReactElement | null => {
  if (!attestation || isRevokedAttestation(attestation)) return null
  return (
    <FieldGrid label="Attestation">
      {attestation.status === 'attested' ? (
        <AttestationBadge attester={attestation.attester} />
      ) : (
        <Typography variant="body2" component="div" className={css.fieldValue} data-testid="erc8176-status-unattested">
          {UNATTESTED_COPY}
        </Typography>
      )}
    </FieldGrid>
  )
}
