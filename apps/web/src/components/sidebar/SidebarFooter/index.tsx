import { type ReactElement, useEffect } from 'react'
import { BEAMER_SELECTOR, loadBeamer } from '@/services/beamer'
import { useAppDispatch, useAppSelector } from '@/store'
import { CookieAndTermType, hasConsentFor } from '@/store/cookiesAndTermsSlice'
import { openCookieBanner } from '@/store/popupSlice'
import BeamerIcon from '@/public/images/sidebar/whats-new.svg'
import HelpCenterIcon from '@/public/images/sidebar/help-center.svg'
import { Box, Divider, ListItem, SvgIcon, Typography, useTheme } from '@mui/material'
import DebugToggle from '../DebugToggle'
import { IS_PRODUCTION, NEW_SUGGESTION_FORM, SUPPORT_FORM } from '@/config/constants'
import Track from '@/components/common/Track'
import { OVERVIEW_EVENTS } from '@/services/analytics/events/overview'
import { useCurrentChain } from '@/hooks/useChains'
import ProtofireLogo from '@/public/images/protofire-logo.svg'
import SuggestionIcon from '@/public/images/sidebar/lightbulb_icon.svg'
import { useIsOfficialHost } from '@/hooks/useIsOfficialHost'
import { SidebarListItemButton, SidebarListItemIcon, SidebarListItemText } from '../SidebarList'
import ExternalLink from '@/components/common/ExternalLink'

const SidebarFooter = (): ReactElement => {
  const dispatch = useAppDispatch()
  const chain = useCurrentChain()
  const hasBeamerConsent = useAppSelector((state) => hasConsentFor(state, CookieAndTermType.UPDATES))
  const isOfficialHost = useIsOfficialHost()
  const theme = useTheme()

  useEffect(() => {
    // Initialise Beamer when consent was previously given
    if (hasBeamerConsent && chain?.shortName) {
      loadBeamer(chain.shortName)
    }
  }, [hasBeamerConsent, chain?.shortName])

  const handleBeamer = () => {
    if (!hasBeamerConsent) {
      dispatch(openCookieBanner({ warningKey: CookieAndTermType.UPDATES }))
    }
  }

  return (
    <>
      {!IS_PRODUCTION && (
        <>
          <ListItem disablePadding>
            <DebugToggle />
          </ListItem>

          <Divider flexItem />
        </>
      )}

      {isOfficialHost && (
        <Track {...OVERVIEW_EVENTS.WHATS_NEW}>
          <ListItem disablePadding>
            <SidebarListItemButton id={BEAMER_SELECTOR} onClick={handleBeamer}>
              <SidebarListItemIcon color="primary">
                <BeamerIcon />
              </SidebarListItemIcon>
              <SidebarListItemText data-testid="list-item-whats-new" bold>
                What&apos;s new
              </SidebarListItemText>
            </SidebarListItemButton>
          </ListItem>
        </Track>
      )}

      <ListItem style={{ padding: 'var(--space-1)' }}>
        <a target="_blank" rel="noopener noreferrer" href={SUPPORT_FORM} style={{ width: '100%' }}>
          <SidebarListItemButton>
            <SidebarListItemIcon color="primary">
              <HelpCenterIcon />
            </SidebarListItemIcon>
            <SidebarListItemText data-testid="list-item-need-help" bold>
              Need help?
            </SidebarListItemText>
          </SidebarListItemButton>
        </a>
      </ListItem>

      <ListItem style={{ padding: '0 var(--space-1) 0' }}>
        <a target="_blank" rel="noopener noreferrer" href={NEW_SUGGESTION_FORM} style={{ width: '100%' }}>
          <SidebarListItemButton
            style={{
              color: 'black',
              backgroundColor:
                theme.palette.mode === 'dark' ? theme.palette.primary.main : theme.palette.secondary.main,
            }}
          >
            <SidebarListItemIcon>
              <Box
                sx={{
                  '& svg': {
                    '& path': () => ({
                      fill: 'black !important',
                    }),
                  },
                }}
              >
                <SuggestionIcon />
              </Box>
            </SidebarListItemIcon>
            <SidebarListItemText bold>New Features Suggestion?</SidebarListItemText>
          </SidebarListItemButton>
        </a>
      </ListItem>
      <ListItem>
        <SidebarListItemText>
          <Typography variant="caption" sx={{ mx: 'auto', textAlign: 'center' }}>
            Supported by{' '}
            <SvgIcon
              component={ProtofireLogo}
              inheritViewBox
              fontSize="small"
              sx={{ verticalAlign: 'middle', mx: 0.5 }}
            />
            <ExternalLink
              href="https://protofire.io/services/solution/safe-deployment"
              sx={{ textDecoration: 'none' }}
              noIcon
            >
              Protofire
            </ExternalLink>
          </Typography>
        </SidebarListItemText>
      </ListItem>
    </>
  )
}

export default SidebarFooter
