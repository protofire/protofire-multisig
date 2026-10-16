import { render } from '@testing-library/react'
import { LifiWidgetFrame } from '.'
import type { WidgetConfig } from '../../types/widget'

jest.mock('@/components/safe-apps/AppFrame', () => ({
  __esModule: true,
  default: ({ appUrl }: { appUrl: string }) => <iframe src={appUrl} title="widget" />,
}))

const WIDGET_URL = 'https://widget.example.com/bridge?fromChain=1'
const WIDGET_ORIGIN = 'https://widget.example.com'

const createConfig = (fromChain: number): WidgetConfig => ({ integrator: 'test', fromChain })

const renderFrame = (config: WidgetConfig) => {
  const result = render(<LifiWidgetFrame url={WIDGET_URL} name="Bridge" config={config} />)
  const contentWindow = result.container.querySelector('iframe')!.contentWindow!
  const postMessage = jest.spyOn(contentWindow, 'postMessage').mockImplementation(() => {})
  return { ...result, postMessage }
}

const dispatchReady = (origin: string) => {
  window.dispatchEvent(new MessageEvent('message', { data: { type: 'iframeReady' }, origin }))
}

describe('LifiWidgetFrame', () => {
  it('should post the config to the widget origin when the iframe is ready', () => {
    const config = createConfig(1)
    const { postMessage } = renderFrame(config)

    dispatchReady(WIDGET_ORIGIN)

    expect(postMessage).toHaveBeenCalledWith(config, WIDGET_ORIGIN)
  })

  it('should ignore ready messages from other origins', () => {
    const { postMessage } = renderFrame(createConfig(1))

    dispatchReady('https://evil.example.com')

    expect(postMessage).not.toHaveBeenCalled()
  })

  it('should ignore messages without a payload', () => {
    const { postMessage } = renderFrame(createConfig(1))

    window.dispatchEvent(new MessageEvent('message', { data: null, origin: WIDGET_ORIGIN }))

    expect(postMessage).not.toHaveBeenCalled()
  })

  it('should post the new config when it changes', () => {
    const { postMessage, rerender } = renderFrame(createConfig(1))
    const nextConfig = createConfig(10)

    rerender(<LifiWidgetFrame url={WIDGET_URL} name="Bridge" config={nextConfig} />)

    expect(postMessage).toHaveBeenCalledWith(nextConfig, WIDGET_ORIGIN)
  })

  it('should stop listening after unmount', () => {
    const { postMessage, unmount } = renderFrame(createConfig(1))

    unmount()
    dispatchReady(WIDGET_ORIGIN)

    expect(postMessage).not.toHaveBeenCalled()
  })
})
