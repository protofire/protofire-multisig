import { useEffect, useState } from 'react'
import { PROTOFIRE_HOSTS } from '@/config/constants'

// Pure predicate, exported for testing without a DOM
export const isAllowedProtofireHost = (host: string): boolean => PROTOFIRE_HOSTS.test(host)

/**
 * Returns whether the current host is one of the Protofire shared-UI hosts.
 * `undefined` while the check is still pending (before hydration), so callers
 * can render a loading state instead of flashing a 404.
 */
export const useIsProtofireHost = (): boolean | undefined => {
  const [isProtofireHost, setIsProtofireHost] = useState<boolean | undefined>(undefined)

  useEffect(() => {
    setIsProtofireHost(isAllowedProtofireHost(window.location.host))
  }, [])

  return isProtofireHost
}
