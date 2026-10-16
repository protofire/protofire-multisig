import { getLifiWidgetConfig } from './useLifiWidgetConfig'
import { LIFI_INTEGRATOR_ID } from '@/config/constants.extra'

describe('getLifiWidgetConfig', () => {
  it('should pin swaps to the Safe chain', () => {
    const config = getLifiWidgetConfig('swap', '137', false, '0x0000000000000000000000000000000000000001')

    expect(config).toMatchObject({
      integrator: LIFI_INTEGRATOR_ID,
      fee: 0.005,
      subvariantOptions: { split: 'swap' },
      appearance: 'light',
      fromChain: 137,
      toChain: 137,
      chains: { from: { allow: [137] } },
      fromToken: '0x0000000000000000000000000000000000000001',
    })
    expect(config.sdkConfig).toBeUndefined()
  })

  it('should let bridges pick the destination chain without switching chains', () => {
    const config = getLifiWidgetConfig('bridge', '10', true)

    expect(config).toMatchObject({
      integrator: LIFI_INTEGRATOR_ID,
      fee: 0.005,
      subvariantOptions: { split: 'bridge' },
      appearance: 'dark',
      fromChain: 10,
      sdkConfig: { routeOptions: { allowSwitchChain: false } },
    })
    expect(config).not.toHaveProperty('toChain')
    expect(config).not.toHaveProperty('fromToken')
  })

  it('should never hide or disable the destination address', () => {
    const configs = [getLifiWidgetConfig('swap', '1', false), getLifiWidgetConfig('bridge', '1', false)]

    configs.forEach((config) => {
      expect(config.hiddenUI).not.toContain('toAddress')
      expect(config.disabledUI ?? []).not.toContain('toAddress')
    })
  })
})
