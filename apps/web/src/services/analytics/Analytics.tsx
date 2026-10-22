import { GA_TRACKING_ID, IS_PRODUCTION, SAFE_APPS_GA_TRACKING_ID } from '@/config/constants'
import { GoogleAnalytics } from '@next/third-parties/google'
import Script from 'next/script'
import { useEffect } from 'react'
import { getGaCookieExpiresSeconds } from './gaCookieExpires'

// Must run before GoogleAnalytics' own `gtag('config')` so the setting applies to every GA tag
const getGaCookieSettingsScript = () => `
  window.dataLayer = window.dataLayer || [];
  function gtag(){window.dataLayer.push(arguments);}
  gtag('set', { cookie_expires: ${getGaCookieExpiresSeconds()} });`

const Analytics = () => {
  useEffect(() => {
    // This needs to be added once in order for events with send_to: SAFE_APPS_GA_TRACKING_ID to work
    window.gtag?.('config', SAFE_APPS_GA_TRACKING_ID, { debug_mode: !IS_PRODUCTION })

    window.gtag?.('consent', 'default', {
      ad_storage: 'denied',
      analytics_storage: 'denied',
      functionality_storage: 'granted',
      personalization_storage: 'denied',
      security_storage: 'granted',
      wait_for_update: 500,
    })
  }, [])

  return (
    <>
      <Script id="ga-cookie-settings" dangerouslySetInnerHTML={{ __html: getGaCookieSettingsScript() }} />
      <GoogleAnalytics gaId={GA_TRACKING_ID} debugMode={!IS_PRODUCTION} />
    </>
  )
}

export default Analytics
