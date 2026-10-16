import { useMemo } from 'react'
import type { ReactElement } from 'react'

import { useCurrentChain } from '@/hooks/useChains'
import { useDarkMode } from '@/hooks/useDarkMode'
import type { Chain } from '@safe-global/store/gateway/AUTO_GENERATED/chains'
import { FEATURES, hasFeature } from '@safe-global/utils/utils/chains'
import { LifiWidgetFrame, useLifiWidgetConfig } from '@/features/lifi'
import { BRIDGE_WIDGET_URL } from '../../constants'

export function BridgeWidget(): ReactElement | null {
  const chain = useCurrentChain()
  const isDarkMode = useDarkMode()
  const config = useLifiWidgetConfig('bridge')
  const isEnabled = !!chain && hasFeature(chain, FEATURES.BRIDGE)
  const url = useMemo(() => (chain ? _getBridgeUrl(chain) : undefined), [chain])

  if (!isEnabled || !url) {
    return null
  }

  return (
    <LifiWidgetFrame
      url={url}
      name="Bridge"
      iconUrl={isDarkMode ? '/images/common/safe-bridge-dark.svg' : '/images/common/safe-bridge.svg'}
      config={config}
    />
  )
}

// fromChain only preselects the source chain until the host posts its config
export function _getBridgeUrl(chain: Chain): string {
  const url = new URL(BRIDGE_WIDGET_URL)
  url.searchParams.set('fromChain', chain.chainId)
  return url.href
}
