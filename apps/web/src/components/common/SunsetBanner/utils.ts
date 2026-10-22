import type { SunsetBannerConfig } from './types'

const isInWindow = ({ startsAt, endsAt }: SunsetBannerConfig, now: Date): boolean =>
  (!startsAt || now >= new Date(startsAt)) && (!endsAt || now < new Date(endsAt))

export const formatDeadline = (deadline: string): string =>
  new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(deadline))

export const getActiveBanner = (
  banners: SunsetBannerConfig[],
  chainId: string,
  now: Date = new Date(),
): SunsetBannerConfig | undefined =>
  banners.find((banner) => banner.chainIds.includes(chainId) && isInWindow(banner, now))

export const interpolateDeadline = ({ description, deadline }: SunsetBannerConfig): string =>
  deadline ? description.replaceAll('{date}', formatDeadline(deadline)) : description
