import { getGaCookieExpiresSeconds } from '../gaCookieExpires'

const DAY_IN_SECONDS = 24 * 60 * 60

describe('getGaCookieExpiresSeconds', () => {
  it('returns the seconds until the same date 14 calendar months later', () => {
    expect(getGaCookieExpiresSeconds(new Date(2026, 5, 15), '')).toBe(426 * DAY_IN_SECONDS)
  })

  it('clamps to the last day of the month and accounts for leap years', () => {
    // 2026-12-31 -> 2028-02-29
    expect(getGaCookieExpiresSeconds(new Date(2026, 11, 31), '')).toBe(425 * DAY_IN_SECONDS)
  })

  it('uses a valid override from the env', () => {
    expect(getGaCookieExpiresSeconds(new Date(2026, 5, 15), '1209600')).toBe(1209600)
  })

  it.each(['abc', '0', '-5', '1.5'])('ignores an invalid override "%s"', (override) => {
    expect(getGaCookieExpiresSeconds(new Date(2026, 5, 15), override)).toBe(426 * DAY_IN_SECONDS)
  })
})
