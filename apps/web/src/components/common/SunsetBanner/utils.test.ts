import { formatDeadline, getActiveBanner, interpolateDeadline } from './utils'
import type { SunsetBannerConfig } from './types'

const banner = (overrides: Partial<SunsetBannerConfig> = {}): SunsetBannerConfig => ({
  id: 'test',
  chainIds: ['1', '2'],
  title: 'Title',
  description: 'Description',
  ...overrides,
})

describe('SunsetBanner utils', () => {
  describe('getActiveBanner', () => {
    const now = new Date('2026-06-15T00:00:00Z')

    it('matches any chain id of a banner', () => {
      const banners = [banner()]

      expect(getActiveBanner(banners, '1', now)).toBe(banners[0])
      expect(getActiveBanner(banners, '2', now)).toBe(banners[0])
    })

    it('returns undefined for chains without a banner', () => {
      expect(getActiveBanner([banner()], '3', now)).toBeUndefined()
    })

    it('hides the banner before startsAt', () => {
      expect(getActiveBanner([banner({ startsAt: '2026-07-01' })], '1', now)).toBeUndefined()
    })

    it('hides the banner from endsAt onwards', () => {
      expect(getActiveBanner([banner({ endsAt: '2026-06-15T00:00:00Z' })], '1', now)).toBeUndefined()
    })

    it('shows the banner inside its window', () => {
      const banners = [banner({ startsAt: '2026-06-01', endsAt: '2026-07-01' })]

      expect(getActiveBanner(banners, '1', now)).toBe(banners[0])
    })
  })

  describe('formatDeadline', () => {
    it('formats ISO dates as long US dates regardless of timezone', () => {
      expect(formatDeadline('2026-07-31')).toBe('July 31, 2026')
    })
  })

  describe('interpolateDeadline', () => {
    it('replaces every {date} placeholder', () => {
      const result = interpolateDeadline(banner({ description: 'Until {date}, yes {date}', deadline: '2029-04-17' }))

      expect(result).toBe('Until April 17, 2029, yes April 17, 2029')
    })

    it('leaves the description untouched without a deadline', () => {
      expect(interpolateDeadline(banner({ description: 'Until {date}' }))).toBe('Until {date}')
    })
  })
})
