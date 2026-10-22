import { addMonths, differenceInSeconds } from 'date-fns'
import { GA_COOKIE_EXPIRES_SECONDS } from '@/config/constants'

// Matches the analytics data retention period
const GA_COOKIE_LIFETIME_MONTHS = 14

export const getGaCookieExpiresSeconds = (now = new Date(), override = GA_COOKIE_EXPIRES_SECONDS): number => {
  const overrideSeconds = Number(override)

  if (override && Number.isInteger(overrideSeconds) && overrideSeconds > 0) {
    return overrideSeconds
  }

  return differenceInSeconds(addMonths(now, GA_COOKIE_LIFETIME_MONTHS), now)
}
