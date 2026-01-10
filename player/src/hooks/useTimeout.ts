import { useEffect, useRef, useCallback } from 'react'
import { useScreenContext } from '../context/ScreenContext'

/**
 * Hook to manage the auto-return timeout for secondary screens.
 * Counts down every second and calls returnToPrimary when it reaches 0.
 */
export function useTimeout() {
  const { mode, activeScreen, timeoutRemaining, setTimeoutRemaining, returnToPrimary, defaultTimeout } = useScreenContext()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Clear any existing interval
  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  // Start/restart the countdown when a secondary screen is shown
  useEffect(() => {
    // Only run timer when in secondary mode
    if (mode !== 'secondary' || !activeScreen) {
      clearTimer()
      return
    }

    // Start countdown
    intervalRef.current = setInterval(() => {
      setTimeoutRemaining((prev) => {
        if (prev === null || prev <= 1) {
          // Time's up! Return to primary
          console.log('⏰ Timeout expired, returning to primary')
          returnToPrimary()
          return null
        }
        return prev - 1
      })
    }, 1000)

    return clearTimer
  }, [mode, activeScreen, clearTimer, setTimeoutRemaining, returnToPrimary])

  // Reset timeout to the screen's configured value or default
  const resetTimeout = useCallback(() => {
    if (activeScreen) {
      const timeout = activeScreen.timeoutSeconds ?? defaultTimeout
      setTimeoutRemaining(timeout)
    }
  }, [activeScreen, defaultTimeout, setTimeoutRemaining])

  // Extend timeout by a number of seconds
  const extendTimeout = useCallback((seconds: number) => {
    setTimeoutRemaining((prev) => (prev ?? 0) + seconds)
  }, [setTimeoutRemaining])

  // Pause the timer (set remaining to null stops the interval effect)
  const pauseTimeout = useCallback(() => {
    clearTimer()
  }, [clearTimer])

  return {
    timeoutRemaining,
    resetTimeout,
    extendTimeout,
    pauseTimeout,
  }
}
