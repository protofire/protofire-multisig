import { GA_COOKIE_EXPIRES_SECONDS, GA_TRACKING_ID, IS_PRODUCTION, SAFE_APPS_GA_TRACKING_ID } from '@/config/constants'
import { GoogleAnalytics } from '@next/third-parties/google'
import { useEffect, useLayoutEffect } from 'react'

// gtag.js only processes `arguments` objects pushed to the dataLayer, not plain arrays
// eslint-disable-next-line unused-imports/no-unused-vars
function pushToDataLayer(..._args: unknown[]) {
  window.dataLayer = window.dataLayer || []
  window.dataLayer.push(arguments)
}

const Analytics = () => {
  // Layout effects run before GoogleAnalytics' init script (injected in an effect) calls `gtag('config')`
  useLayoutEffect(() => {
    pushToDataLayer('set', { cookie_expires: GA_COOKIE_EXPIRES_SECONDS })
  }, [])

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

  return <GoogleAnalytics gaId={GA_TRACKING_ID} debugMode={!IS_PRODUCTION} />
}

export default Analytics
