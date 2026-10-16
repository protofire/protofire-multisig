import { FEATURES } from '@safe-global/utils/utils/chains'
import { useHasFeature } from '@/hooks/useChains'
import { CounterfactualFeature, CounterfactualHooksFeature } from '@/features/counterfactual'

jest.mock('@/hooks/useChains', () => ({ useHasFeature: jest.fn() }))

const mockFeatures = (features: Partial<Record<FEATURES, boolean | undefined>>) =>
  (useHasFeature as jest.Mock).mockImplementation((feature: FEATURES) => features[feature])

describe('CounterfactualHooksFeature', () => {
  it('shares the counterfactual chunk', () => {
    expect(CounterfactualHooksFeature.name).toBe(CounterfactualFeature.name)
    expect(CounterfactualHooksFeature.load).toBe(CounterfactualFeature.load)
  })

  it('is enabled on Tron without COUNTERFACTUAL (direct deployments need the pending-safe hooks)', () => {
    mockFeatures({ [FEATURES.COUNTERFACTUAL]: false, [FEATURES.TRON]: true })
    expect(CounterfactualHooksFeature.useIsEnabled()).toBe(true)
    expect(CounterfactualFeature.useIsEnabled()).toBe(false)
  })

  it('is enabled on chains with COUNTERFACTUAL', () => {
    mockFeatures({ [FEATURES.COUNTERFACTUAL]: true, [FEATURES.TRON]: false })
    expect(CounterfactualHooksFeature.useIsEnabled()).toBe(true)
  })

  it('is disabled when neither feature is set, and undefined while chains are loading', () => {
    mockFeatures({ [FEATURES.COUNTERFACTUAL]: false, [FEATURES.TRON]: false })
    expect(CounterfactualHooksFeature.useIsEnabled()).toBe(false)

    mockFeatures({})
    expect(CounterfactualHooksFeature.useIsEnabled()).toBeUndefined()
  })
})
