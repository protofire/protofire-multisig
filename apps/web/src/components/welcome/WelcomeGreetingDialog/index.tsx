import { useEffect, useState, type ReactElement } from 'react'
import { Box, Button, Collapse, DialogContent, IconButton, List, ListItem, Skeleton, Typography } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ModalDialog from '@/components/common/ModalDialog'
import ChainIndicator from '@/components/common/ChainIndicator'
import useChains from '@/hooks/useChains'
import ProtofireLogo from '@/public/images/protofire.svg'
import type { Chain } from '@safe-global/store/gateway/AUTO_GENERATED/chains'
import { pickRandomChains } from './pickRandomChains'
import { formatNetworkCount } from '../WelcomeRightPanel/utils'
import css from './styles.module.css'

const MAX_CHAIN_LOGOS = 8
const CHAIN_LOGO_SIZE = 32

const getFeatures = (networkCount: number) => [
  {
    title: 'One UI, every network',
    description: `Manage your Safes across ${
      networkCount > 1 ? formatNetworkCount(networkCount) : 'all'
    } supported networks without switching interfaces.`,
  },
  {
    title: 'Fully non-custodial',
    description: 'Your assets stay on-chain. Protofire Multisig never holds your keys or funds.',
  },
  {
    title: 'Security first',
    description:
      "Protofire's dedicated team keeps the interface up to date with security best practices, while your Safes remain on the audited Safe contracts on-chain.",
  },
]

const MIGRATION_INTRO = [
  'Safe Accounts live on-chain. Your Safes, balances and transaction history are already accessible in Protofire Multisig.',
  'The only things stored locally are your address book, added Safes and settings. You can bring those over in a minute following the steps below.',
]

const MIGRATION_STEPS: ReactElement[] = [
  <>
    On your current Safe UI, open <b>Settings → Data</b>.
  </>,
  <>
    Click <b>Export</b> to download your <code>safe-YYYY-MM-DD.json</code> file — it contains your address book, added
    Safes, and settings.
  </>,
  <>
    On Protofire Multisig, open <b>Settings → Data</b> and drop that file into <b>Data import</b>.
  </>,
]

interface WelcomeGreetingDialogProps {
  open: boolean
  onClose: () => void
}

const WelcomeGreetingDialog = ({ open, onClose }: WelcomeGreetingDialogProps): ReactElement => {
  const [isMigrationOpen, setIsMigrationOpen] = useState(false)
  const { configs, loading } = useChains()
  const features = getFeatures(configs.length)
  const [chains, setChains] = useState<Chain[]>([])

  useEffect(() => {
    if (loading) return
    setChains((current) => {
      if (current.length) return current
      const picked = pickRandomChains(configs, MAX_CHAIN_LOGOS)
      return picked.length ? picked : current
    })
  }, [loading, configs])

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      hideChainIndicator
      maxWidth="md"
      fullWidth
      sx={{
        '& .MuiDialog-paper': { backgroundColor: 'var(--color-static-main)', color: 'var(--color-static-primary)' },
      }}
    >
      <IconButton aria-label="close" onClick={onClose} size="small" className={css.closeButton}>
        <CloseIcon />
      </IconButton>

      <DialogContent className={css.content}>
        {!isMigrationOpen && (
          <Box className={css.brand} data-testid="welcome-greeting-logo">
            <ProtofireLogo className={css.logo} />
            <Typography variant="h5" fontWeight={700}>
              Protofire Multisig
            </Typography>
          </Box>
        )}

        <List className={css.list}>
          {features.map(({ title, description }) => (
            <ListItem key={title} className={css.listItem}>
              <b>{title}</b> — {description}
            </ListItem>
          ))}
        </List>

        {(loading || chains.length > 0) && (
          <Box className={css.chains} data-testid="welcome-greeting-chains">
            {loading
              ? Array.from({ length: MAX_CHAIN_LOGOS }).map((_, index) => (
                  <Skeleton key={index} variant="circular" width={CHAIN_LOGO_SIZE} height={CHAIN_LOGO_SIZE} />
                ))
              : chains.map((chain) => (
                  <ChainIndicator key={chain.chainId} chainId={chain.chainId} onlyLogo imageSize={CHAIN_LOGO_SIZE} />
                ))}
          </Box>
        )}

        <Button
          className={css.toggle}
          onClick={() => setIsMigrationOpen((prev) => !prev)}
          aria-expanded={isMigrationOpen}
          endIcon={<ExpandMoreIcon className={isMigrationOpen ? css.chevronOpen : undefined} />}
          disableRipple
        >
          How to migrate your account
        </Button>

        <Collapse in={isMigrationOpen} unmountOnExit className={css.collapse}>
          <Box id="welcome-greeting-migration" data-testid="welcome-greeting-migration">
            <List className={css.list}>
              {MIGRATION_INTRO.map((text) => (
                <ListItem key={text} className={css.listItem}>
                  {text}
                </ListItem>
              ))}
            </List>

            <List component="ol" className={css.steps}>
              {MIGRATION_STEPS.map((step, index) => (
                <ListItem key={index} className={css.listItem}>
                  {step}
                </ListItem>
              ))}
            </List>
          </Box>
        </Collapse>

        <Button variant="contained" disableElevation onClick={onClose} className={css.cta}>
          Go to Protofire Multisig
        </Button>
      </DialogContent>
    </ModalDialog>
  )
}

export default WelcomeGreetingDialog
