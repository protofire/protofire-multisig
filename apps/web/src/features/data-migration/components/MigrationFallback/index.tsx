import type { ReactElement } from 'react'
import Link from 'next/link'
import { Alert, AlertTitle, Typography, Button } from '@mui/material'
import { AppRoutes } from '@/config/routes'

const MigrationFallback = (): ReactElement => (
  <Alert severity="info" data-testid="migration-fallback">
    <AlertTitle sx={{ fontWeight: 700 }}>We couldn&apos;t read your data</AlertTitle>
    <Typography variant="body2" mb={2}>
      The migration link looks incomplete or has expired. You can still move your data manually: go back to your
      previous Safe UI, export your data from <b>Settings → Data</b>, then import the file here on the same page.
    </Typography>
    <Button variant="contained" component={Link} href={AppRoutes.settings.data}>
      Open Settings → Data
    </Button>
  </Alert>
)

export default MigrationFallback
