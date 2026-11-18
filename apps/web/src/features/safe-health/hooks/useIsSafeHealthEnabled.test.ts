import { renderHook } from '@testing-library/react'
import { FEATURES } from '@safe-global/utils/utils/chains'
import { useHasFeature } from '@/hooks/useChains'
import { useIsProtofireHost } from '@/hooks/useIsProtofireHost'
import { SafeHealthFeature, useIsSafeHealthEnabled } from '@/features/safe-health'

jest.mock('@/hooks/useChains', () => ({ useHasFeature: jest.fn() }))
jest.mock('@/hooks/useIsProtofireHost', () => ({ useIsProtofireHost: jest.fn() }))

type Flag = boolean | undefined

const mockFeatures = (features: Partial<Record<FEATURES, Flag>>) =>
  (useHasFeature as jest.Mock).mockImplementation((feature: FEATURES) => features[feature])

const mockHost = (host: Flag) => (useIsProtofireHost as jest.Mock).mockReturnValue(host)

const run = () => renderHook(() => useIsSafeHealthEnabled()).result.current

describe('useIsSafeHealthEnabled', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it.each([
    [true, true, true],
    [true, false, false],
    [false, true, false],
    [false, false, false],
    [undefined, true, undefined],
    [true, undefined, undefined],
    [undefined, undefined, undefined],
  ] as [Flag, Flag, Flag][])('flag %s and host %s -> %s', (flag, host, expected) => {
    mockFeatures({ [FEATURES.SAFE_HEALTH]: flag })
    mockHost(host)

    expect(run()).toBe(expected)
  })

  it('is disabled on Tron', () => {
    mockFeatures({ [FEATURES.SAFE_HEALTH]: true, [FEATURES.TRON]: true })
    mockHost(true)

    expect(run()).toBe(false)
  })

  it('is disabled on Hedera', () => {
    mockFeatures({ [FEATURES.SAFE_HEALTH]: true, [FEATURES.HEDERA]: true })
    mockHost(true)

    expect(run()).toBe(false)
  })

  it('is used as the feature handle gate', () => {
    mockFeatures({ [FEATURES.SAFE_HEALTH]: true })
    mockHost(true)

    expect(renderHook(() => SafeHealthFeature.useIsEnabled()).result.current).toBe(true)
  })
})
