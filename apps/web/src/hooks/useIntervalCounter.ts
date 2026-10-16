import { useCallback, useEffect, useState } from 'react'

const useIntervalCounter = (interval: number, enabled = true, maxCount = Infinity): [number, () => void] => {
  const [counter, setCounter] = useState<number>(0)

  const resetCounter = useCallback(() => {
    setCounter(0)
  }, [setCounter])

  useEffect(() => {
    if (!enabled || counter >= maxCount) return

    let reqFrameId: number
    const timerId = setTimeout(() => {
      // requestAnimationFrame prevents the timer from ticking in a background tab
      reqFrameId = requestAnimationFrame(() => {
        setCounter(counter + 1)
      })
    }, interval)
    return () => {
      clearTimeout(timerId)
      if (reqFrameId) {
        cancelAnimationFrame(reqFrameId)
      }
    }
  }, [counter, interval, enabled, maxCount])

  return [counter, resetCounter]
}

export default useIntervalCounter
