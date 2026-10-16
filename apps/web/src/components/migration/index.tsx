import { useMemo, type ReactElement } from 'react'
import { Box, Button, Container, List, ListItem, Paper, Skeleton, Stack, Typography } from '@mui/material'
import type { SxProps, Theme } from '@mui/material/styles'
import Link from 'next/link'
import { AppRoutes } from '@/config/routes'
import InfoBox from '@/components/safe-messages/InfoBox'
import useChains from '@/hooks/useChains'
import { getInstanceFromChainName } from './getInstanceFromChainName'
import NetworkChip from './NetworkChip'
import type { MigrationParams } from './parseMigrationParams'

const getHeading = (instance?: string): string =>
  instance ? `${instance} has moved to Protofire` : 'These networks have moved to Protofire Safe'

const getDiscontinuedMessage = (instance?: string): string =>
  instance
    ? `${instance} interface that was previously hosted for those networks by Protofire team has been discontinued.`
    : 'The Safe interface that was previously hosted for those networks by Protofire team has been discontinued.'

interface MigrationProps {
  params: MigrationParams
}

const Migration = ({ params }: MigrationProps): ReactElement => {
  const { chainIds } = params
  const { configs, loading } = useChains()

  const supportedNetworks = useMemo(() => {
    if (!chainIds.length) return []

    return chainIds
      .map((chainId) => configs.find((config) => config.chainId === chainId))
      .filter((chain) => chain !== undefined)
      .map((chain) => ({
        chainId: chain.chainId,
        name: chain.chainName,
        logo: chain.chainLogoUri ?? undefined,
      }))
  }, [chainIds, configs])

  const instance = useMemo(() => {
    const firstChainId = chainIds[0]
    if (!firstChainId) return undefined

    const firstChain = configs.find((config) => config.chainId === firstChainId)
    if (!firstChain) return undefined

    return getInstanceFromChainName(firstChain.chainName)
  }, [chainIds, configs])

  const showSupportedNetworks = !loading && supportedNetworks.length > 0
  const showSupportedNetworksLoading = loading && chainIds.length > 0
  const networkCount = supportedNetworks.length
  const shouldCenterNetworks = networkCount <= 2
  const networksLayoutSx: SxProps<Theme> = shouldCenterNetworks
    ? {
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 1.5,
      }
    : {
        display: 'grid',
        gridTemplateColumns: { xs: '1fr 1fr', sm: '1fr 1fr 1fr' },
        gap: 1.5,
      }

  return (
    <Container maxWidth="sm" sx={{ py: 5 }}>
      <Paper sx={{ p: { xs: 3, sm: 5 } }}>
        <Stack gap={3} alignItems="center" sx={{ textAlign: 'center' }}>
          <Typography variant="h2" fontWeight={700}>
            {getHeading(instance)}
          </Typography>

          <Box
            sx={{
              width: '100%',
              '& [data-testid="message-infobox"]': {
                alignItems: 'center',
              },
            }}
          >
            <InfoBox title="This is not a hack or phishing" message="You were redirected here on purpose." />
          </Box>

          <Box sx={{ width: '100%' }}>
            <Typography variant="h5" fontWeight={700} mb={1}>
              Why the change
            </Typography>
            <List sx={{ listStyleType: 'disc', display: 'inline-block', textAlign: 'left', pl: 3, py: 0, m: 0 }}>
              <ListItem sx={{ display: 'list-item', px: 0 }}>{getDiscontinuedMessage(instance)}</ListItem>
              <ListItem sx={{ display: 'list-item', px: 0 }}>
                Protofire now provides one dedicated interface for them at{' '}
                <Box component="span" sx={{ fontWeight: 700 }}>
                  app.safe.protofire.io.
                </Box>
              </ListItem>
            </List>
          </Box>

          <Typography variant="body1">
            Your Safe accounts, owners, and funds are unchanged — only the website URL is different. Your assets live
            on-chain and remain fully under your control.
          </Typography>

          {(showSupportedNetworksLoading || showSupportedNetworks) && (
            <Box sx={{ width: '100%' }}>
              <Typography variant="h5" fontWeight={700} mb={1.5}>
                Supported networks
              </Typography>
              {showSupportedNetworksLoading ? (
                <Box sx={networksLayoutSx}>
                  {chainIds.map((chainId) => (
                    <Skeleton key={chainId} variant="rounded" height={44} width={shouldCenterNetworks ? 160 : '100%'} />
                  ))}
                </Box>
              ) : (
                <Box sx={networksLayoutSx}>
                  {supportedNetworks.map((supportedNetwork) => (
                    <NetworkChip
                      key={supportedNetwork.chainId}
                      name={supportedNetwork.name}
                      logo={supportedNetwork.logo}
                    />
                  ))}
                </Box>
              )}
            </Box>
          )}

          <Button variant="contained" size="large" LinkComponent={Link} href={AppRoutes.welcome.index}>
            Open Protofire Safe
          </Button>
        </Stack>
      </Paper>
    </Container>
  )
}

export default Migration
