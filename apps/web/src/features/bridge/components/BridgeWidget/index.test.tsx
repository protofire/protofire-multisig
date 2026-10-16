import { _getBridgeUrl } from '@/features/bridge/components/BridgeWidget'
import { BRIDGE_WIDGET_URL } from '@/features/bridge/constants'
import { LIFI_WIDGET_URL } from '@/config/constants.extra'
import { chainBuilder } from '@/tests/builders/chains'

describe('BridgeWidget', () => {
  describe('BRIDGE_WIDGET_URL', () => {
    it('should point to the bridge route of the LI.FI widget', () => {
      expect(BRIDGE_WIDGET_URL).toBe(new URL('/bridge', LIFI_WIDGET_URL).href)
    })
  })

  describe('_getBridgeUrl', () => {
    it('should preselect the Safe chain as the source chain', () => {
      const chain = chainBuilder().build()

      const url = new URL(_getBridgeUrl(chain))

      expect(`${url.origin}${url.pathname}`).toBe(BRIDGE_WIDGET_URL)
      expect(url.searchParams.get('fromChain')).toBe(chain.chainId)
      expect(url.searchParams.has('theme')).toBe(false)
    })
  })
})
