import { Alert } from '@mui/material'
import type { ReactElement } from 'react'

import { RECOVERY_LOAD_ERROR_MESSAGE } from '../../recoveryLoadError'

export function RecoveryLoadError(): ReactElement {
  return (
    <Alert severity="error" data-testid="recovery-error" sx={{ mb: 2 }}>
      {RECOVERY_LOAD_ERROR_MESSAGE}
    </Alert>
  )
}
