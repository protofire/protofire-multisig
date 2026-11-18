import type { ReactElement } from 'react'
import { Paper, Typography } from '@mui/material'
import { WidgetCard } from '@/components/dashboard/styled'
import useSafeInfo from '@/hooks/useSafeInfo'
import { useSafeHealthChecks } from '../../hooks/useSafeHealthChecks'
import SafeHealthList, { type SafeHealthListVariant } from '../SafeHealthList'

const UNDEPLOYED_TEXT = 'Checks start after activation.'

export const Undeployed = ({ variant }: { variant: SafeHealthListVariant }): ReactElement =>
  variant === 'home' ? (
    <WidgetCard title="Safe setup">
      <Typography variant="body2" color="text.secondary" px={1.5} py={0.75}>
        {UNDEPLOYED_TEXT}
      </Typography>
    </WidgetCard>
  ) : (
    <Paper sx={{ p: 4, mb: 2 }}>
      <Typography variant="h4" fontWeight={700} mb={1}>
        Safe setup
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {UNDEPLOYED_TEXT}
      </Typography>
    </Paper>
  )

const SafeHealthChecklist = ({ variant }: { variant: SafeHealthListVariant }): ReactElement | null => {
  const { safe, safeLoaded } = useSafeInfo()
  const { checks, hideVersionOnHome } = useSafeHealthChecks()

  if (!safeLoaded) return null
  if (!safe.deployed) return <Undeployed variant={variant} />

  return <SafeHealthList checks={checks} variant={variant} hideVersion={hideVersionOnHome} />
}

export default SafeHealthChecklist
