export type SunsetBannerSeverity = 'info' | 'warning' | 'error'

export type SunsetBannerConfig = {
  id: string
  chainIds: string[]
  title: string
  /** Supports `**bold**`, `[text](https://url)`, line breaks and the `{date}` placeholder */
  description: string
  /** ISO date, substituted for `{date}` in the description */
  deadline?: string
  /** ISO date, the banner is hidden before it */
  startsAt?: string
  /** ISO date, the banner is hidden from it onwards */
  endsAt?: string
  severity?: SunsetBannerSeverity
}
