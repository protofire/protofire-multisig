import { useState, type ReactElement } from 'react'
import { Box, Button, Container, List, ListItem, Paper, Stack, Typography } from '@mui/material'
import Link from 'next/link'
import { AppRoutes } from '@/config/routes'
import ErrorMessage from '@/components/tx/ErrorMessage'

const SUPERCHAIN_NETWORKS: Array<{ name: string; logo: string }> = [
  { name: 'Cyber', logo: '/images/superchain-migration/cyber.png' },
  { name: 'Superseed', logo: '/images/superchain-migration/superseed.png' },
  { name: 'Soneium', logo: '/images/superchain-migration/soneium.png' },
  { name: 'Ink Testnet', logo: '/images/superchain-migration/ink.png' },
  { name: 'Lisk', logo: '/images/superchain-migration/lisk.png' },
  { name: 'Metal L2', logo: '/images/superchain-migration/metal-l2.png' },
]

const NetworkChip = ({ name, logo }: { name: string; logo: string }): ReactElement => {
  const [showLogo, setShowLogo] = useState(true)

  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="center"
      gap={1}
      sx={{
        px: 2,
        py: 1,
        borderRadius: 1,
        border: ({ palette }) => `1px solid ${palette.border.light}`,
        backgroundColor: ({ palette }) => palette.background.main,
      }}
    >
      {showLogo && (
        <img
          src={logo}
          alt={`${name} logo`}
          width={28}
          height={28}
          loading="lazy"
          onError={() => setShowLogo(false)}
          style={{ borderRadius: '50%' }}
        />
      )}
      <Typography variant="body2" fontWeight={700}>
        {name}
      </Typography>
    </Stack>
  )
}

const SuperchainMigration = (): ReactElement => (
  <Container maxWidth="sm" sx={{ py: 5 }}>
    <Paper sx={{ p: { xs: 3, sm: 5 } }}>
      <Stack gap={3} alignItems="center" sx={{ textAlign: 'center' }}>
        <Typography variant="h2" fontWeight={700}>
          These networks have moved to Protofire Safe
        </Typography>

        <Box sx={{ width: '100%' }}>
          <ErrorMessage level="info" title="This is not a hack or phishing">
            You were redirected here on purpose.
          </ErrorMessage>
        </Box>

        <Box sx={{ width: '100%' }}>
          <Typography variant="h5" fontWeight={700} mb={1}>
            Why the change
          </Typography>
          <List sx={{ listStyleType: 'disc', display: 'inline-block', textAlign: 'left', pl: 3, py: 0, m: 0 }}>
            <ListItem sx={{ display: 'list-item', px: 0 }}>
              Superchain Safe interface that was previously hosted for those networks by Protofire team has been
              discontinued.
            </ListItem>
            <ListItem sx={{ display: 'list-item', px: 0 }}>
              Protofire now provides one dedicated interface for them at app.safe.protofire.io.
            </ListItem>
          </List>
        </Box>

        <Typography variant="body1">
          Your Safe accounts, owners, and funds are unchanged — only the website URL is different. Your assets live
          on-chain and remain fully under your control.
        </Typography>

        <Box sx={{ width: '100%' }}>
          <Typography variant="h5" fontWeight={700} mb={1.5}>
            Affected networks
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr 1fr', sm: '1fr 1fr 1fr' },
              gap: 1.5,
            }}
          >
            {SUPERCHAIN_NETWORKS.map((network) => (
              <NetworkChip key={network.name} name={network.name} logo={network.logo} />
            ))}
          </Box>
        </Box>

        <Button variant="contained" size="large" LinkComponent={Link} href={AppRoutes.welcome.index}>
          Open Protofire Safe
        </Button>
      </Stack>
    </Paper>
  </Container>
)

export default SuperchainMigration
