import { useCallback, useEffect, useMemo, useRef, type ReactElement } from 'react'
import { Box } from '@mui/material'
import AppFrame from '@/components/safe-apps/AppFrame'
import { getEmptySafeApp } from '@/components/safe-apps/utils'
import type { WidgetConfig } from '../../types/widget'

type LifiWidgetFrameProps = {
  url: string
  name: string
  config: WidgetConfig
  iconUrl?: string
  className?: string
}

const IFRAME_READY_MESSAGE = 'iframeReady'

const isIframeReadyMessage = (data: unknown): boolean =>
  typeof data === 'object' && data !== null && (data as { type?: unknown }).type === IFRAME_READY_MESSAGE

export const LifiWidgetFrame = ({ url, name, config, iconUrl, className }: LifiWidgetFrameProps): ReactElement => {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetOrigin = useMemo(() => new URL(url).origin, [url])
  const safeApp = useMemo(() => {
    const emptySafeApp = getEmptySafeApp(url)
    return { ...emptySafeApp, name, iconUrl: iconUrl ?? emptySafeApp.iconUrl }
  }, [url, name, iconUrl])

  // The iframe is looked up on every post because AppFrame renders it only once the Safe has loaded
  const postConfig = useCallback(() => {
    containerRef.current?.querySelector('iframe')?.contentWindow?.postMessage(config, widgetOrigin)
  }, [config, widgetOrigin])

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin === widgetOrigin && isIframeReadyMessage(event.data)) {
        postConfig()
      }
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [postConfig, widgetOrigin])

  useEffect(() => {
    postConfig()
  }, [postConfig])

  return (
    <Box ref={containerRef} className={className}>
      <AppFrame
        appUrl={safeApp.url}
        allowedFeaturesList="clipboard-read; clipboard-write"
        safeAppFromManifest={safeApp}
        isNativeEmbed
      />
    </Box>
  )
}

export default LifiWidgetFrame
