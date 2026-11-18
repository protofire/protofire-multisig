import type { ReactElement, ReactNode } from 'react'
import NextLink from 'next/link'
import { Box, CircularProgress, Grid, Link, Paper, Stack, SvgIcon, Typography, type SxProps } from '@mui/material'
import type { Theme } from '@mui/material/styles'
import CheckIcon from '@/public/images/common/check.svg'
import InfoIcon from '@/public/images/notifications/info.svg'
import { AppRoutes } from '@/config/routes'
import { WidgetCard } from '@/components/dashboard/styled'
import EthHashInfo from '@/components/common/EthHashInfo'
import Track from '@/components/common/Track'
import { useSafeQueryParam } from '@/hooks/useSafeAddressFromUrl'
import { SAFE_HEALTH_EVENTS } from '@/services/analytics/events/safe-health'
import type { CheckId, CheckStatus, HealthCheck } from '../../services/checks'

export type SafeHealthListVariant = 'home' | 'settings'

type Props = {
  checks: HealthCheck[]
  variant: SafeHealthListVariant
  hideVersion?: boolean
}

const ROW_EVENTS: Record<CheckId, { action: string; category: string }> = {
  owners: SAFE_HEALTH_EVENTS.OPEN_OWNERS,
  version: SAFE_HEALTH_EVENTS.OPEN_CONTRACT_VERSION,
  modules: SAFE_HEALTH_EVENTS.OPEN_MODULES,
  guard: SAFE_HEALTH_EVENTS.OPEN_GUARD,
  fallbackHandler: SAFE_HEALTH_EVENTS.OPEN_FALLBACK_HANDLER,
  recovery: SAFE_HEALTH_EVENTS.OPEN_RECOVERY,
}

const ROW_ROUTES: Record<CheckId, string> = {
  owners: AppRoutes.settings.setup,
  version: AppRoutes.settings.setup,
  modules: AppRoutes.settings.modules,
  guard: AppRoutes.settings.modules,
  fallbackHandler: AppRoutes.settings.modules,
  recovery: AppRoutes.settings.security,
}

const FOOTER_TEXT =
  'Not checked here: owner type (EOA or contract), module guard, creation factory, multichain setup, pending queue.'

const StatusIcon = ({ status }: { status: CheckStatus }): ReactElement => {
  if (status === 'loading') return <CircularProgress size={16} />
  if (status === 'ok') return <SvgIcon component={CheckIcon} inheritViewBox fontSize="small" color="success" />
  return <SvgIcon component={InfoIcon} inheritViewBox fontSize="small" color="border" />
}

const RowLink = ({
  check,
  sx,
  children,
}: {
  check: HealthCheck
  sx?: SxProps<Theme>
  children: ReactNode
}): ReactElement => {
  const safe = useSafeQueryParam()

  return (
    <Track {...ROW_EVENTS[check.id]} label={check.state}>
      <NextLink href={{ pathname: ROW_ROUTES[check.id], query: { safe } }} passHref legacyBehavior>
        <Link sx={{ textDecoration: 'none', color: 'text.primary', ...sx }}>{children}</Link>
      </NextLink>
    </Track>
  )
}

const HomeRow = ({ check }: { check: HealthCheck }): ReactElement => (
  <RowLink
    check={check}
    sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 1,
      px: 1.5,
      py: 0.75,
      borderRadius: 1,
      '&:hover': { bgcolor: 'action.hover' },
    }}
  >
    <StatusIcon status={check.status} />
    <Typography variant="body2" fontWeight={700}>
      {check.title}
    </Typography>
    <Typography variant="body2" color="text.secondary">
      {check.summary}
    </Typography>
  </RowLink>
)

const SettingsRow = ({ check }: { check: HealthCheck }): ReactElement => (
  <Stack direction="row" gap={1.5} alignItems="flex-start">
    <Box pt={0.25}>
      <StatusIcon status={check.status} />
    </Box>

    <Stack gap={0.5}>
      <RowLink check={check} sx={{ fontWeight: 700, '&:hover': { textDecoration: 'underline' } }}>
        {check.title}
      </RowLink>
      <Typography variant="body2">{check.summary}</Typography>
      {check.detail && (
        <Typography variant="body2" color="text.secondary">
          {check.detail}
        </Typography>
      )}
      {check.items?.map((item) => (
        <EthHashInfo key={item.value} address={item.value} name={item.name ?? undefined} showCopyButton hasExplorer />
      ))}
    </Stack>
  </Stack>
)

const SafeHealthHome = ({ checks, hideVersion }: Omit<Props, 'variant'>): ReactElement => {
  const safe = useSafeQueryParam()
  const allSet = checks.every((check) => check.status === 'ok')
  const rows = hideVersion ? checks.filter((check) => check.id !== 'version') : checks

  return (
    <WidgetCard
      title="Safe setup"
      viewAllUrl={{ pathname: AppRoutes.settings.setup, query: { safe } }}
      viewAllText="View all in Settings"
      viewAllWrapper={(link) => <Track {...SAFE_HEALTH_EVENTS.VIEW_ALL}>{link}</Track>}
    >
      {allSet ? (
        <Stack direction="row" alignItems="center" gap={1} px={1.5} py={0.75}>
          <StatusIcon status="ok" />
          <Typography variant="body2">All {checks.length} checks set</Typography>
        </Stack>
      ) : (
        <Stack>
          {rows.map((check) => (
            <HomeRow key={check.id} check={check} />
          ))}
        </Stack>
      )}
    </WidgetCard>
  )
}

const SafeHealthSettings = ({ checks }: Pick<Props, 'checks'>): ReactElement => (
  <Paper sx={{ p: 4, mb: 2 }}>
    <Grid container spacing={3}>
      <Grid item lg={4} xs={12}>
        <Typography variant="h4" fontWeight={700}>
          Safe setup
        </Typography>

        <Typography variant="body2" color="text.secondary" mt={1}>
          A read-only overview of how this Safe Account is set up.
        </Typography>

        <Typography variant="caption" color="text.secondary" display="block" mt={2}>
          {FOOTER_TEXT}
        </Typography>
      </Grid>

      <Grid item xs>
        <Grid container spacing={3}>
          {checks.map((check) => (
            <Grid item xs={12} md={6} key={check.id}>
              <SettingsRow check={check} />
            </Grid>
          ))}
        </Grid>
      </Grid>
    </Grid>
  </Paper>
)

const SafeHealthList = ({ checks, variant, hideVersion }: Props): ReactElement =>
  variant === 'home' ? (
    <SafeHealthHome checks={checks} hideVersion={hideVersion} />
  ) : (
    <SafeHealthSettings checks={checks} />
  )

export default SafeHealthList
