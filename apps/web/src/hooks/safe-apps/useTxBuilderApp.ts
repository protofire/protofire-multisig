import { useMemo } from 'react'
import { useRouter } from 'next/router'
import type { UrlObject } from 'url'

import { IS_PRODUCTION, SafeAppsName } from '@/config/constants'
import { AppRoutes } from '@/config/routes'
import { useRemoteSafeApps } from '@/hooks/safe-apps/useRemoteSafeApps'

// Last resort while the remote list is loading or the app is not registered
const FALLBACK_TX_BUILDER_URL = IS_PRODUCTION
  ? 'https://apps.safe.protofire.io/tx-builder'
  : 'https://dev-apps.safe.protofire.io/tx-builder'

/**
 * Resolve the Transaction Builder link from the chain's registered Safe Apps.
 * Forks host tx-builder on their own domains, so the config service entry is
 * the source of truth rather than a hardcoded upstream URL.
 */
export const useTxBuilderApp = (): { link: UrlObject } => {
  const router = useRouter()
  const [matchingApps] = useRemoteSafeApps({ name: SafeAppsName.TRANSACTION_BUILDER })
  const appUrl = matchingApps?.[0]?.url ?? FALLBACK_TX_BUILDER_URL

  return useMemo(
    () => ({
      link: {
        pathname: AppRoutes.apps.open,
        query: { safe: router.query.safe, appUrl },
      },
    }),
    [router.query.safe, appUrl],
  )
}
