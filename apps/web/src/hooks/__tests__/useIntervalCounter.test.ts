import { act, renderHook } from '@testing-library/react'
import useIntervalCounter from '@/hooks/useIntervalCounter'

describe('useIntervalCounter', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('increments the value over time', () => {
    const { result } = renderHook(() => useIntervalCounter(100))

    expect(result.current[0]).toBe(0)

    act(() => {
      jest.advanceTimersByTime(200)
    })

    expect(result.current[0]).toBe(1)
  })

  it('resets the counter', () => {
    const { result } = renderHook(() => useIntervalCounter(100))

    act(() => {
      jest.advanceTimersByTime(200)
    })
    expect(result.current[0]).toBe(1)

    act(() => {
      result.current[1]()
    })

    expect(result.current[0]).toBe(0)
  })

  it('does not schedule any ticks while disabled', () => {
    const { result } = renderHook(() => useIntervalCounter(100, false))

    act(() => {
      jest.advanceTimersByTime(1000)
    })

    expect(result.current[0]).toBe(0)
  })

  it('resumes ticking once re-enabled', () => {
    let enabled = false
    const { result, rerender } = renderHook(() => useIntervalCounter(100, enabled))

    act(() => {
      jest.advanceTimersByTime(1000)
    })
    expect(result.current[0]).toBe(0)

    enabled = true
    rerender()

    act(() => {
      jest.advanceTimersByTime(200)
    })

    expect(result.current[0]).toBe(1)
  })

  it('stops ticking once maxCount is reached', () => {
    const { result } = renderHook(() => useIntervalCounter(100, true, 2))

    act(() => {
      jest.advanceTimersByTime(200)
    })
    expect(result.current[0]).toBe(1)

    act(() => {
      jest.advanceTimersByTime(200)
    })
    expect(result.current[0]).toBe(2)

    // Already at maxCount: further time must not advance the counter beyond it
    act(() => {
      jest.advanceTimersByTime(1000)
    })
    expect(result.current[0]).toBe(2)
  })

  it('resumes ticking past a spent maxCount after reset', () => {
    const { result } = renderHook(() => useIntervalCounter(100, true, 2))

    act(() => {
      jest.advanceTimersByTime(200)
    })
    act(() => {
      jest.advanceTimersByTime(200)
    })
    expect(result.current[0]).toBe(2)

    act(() => {
      result.current[1]()
    })
    expect(result.current[0]).toBe(0)

    act(() => {
      jest.advanceTimersByTime(200)
    })
    expect(result.current[0]).toBe(1)
  })
})
