import { useEffect, useState } from 'react'

export const useDelayedVisibility = (delay: number): boolean => {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const timeout = setTimeout(() => setIsVisible(true), delay)
    return () => clearTimeout(timeout)
  }, [delay])

  return isVisible
}
