import { useEffect, useCallback } from 'react'
import { useSleepMode } from '../context/SleepModeContext'

/**
 * Hook to handle keyboard controls for overlay modes.
 *
 * Key bindings:
 * - 0: Toggle sleep mode (barista away)
 * - 9: Toggle closed mode (cafe closed for the day)
 */
export function useSleepModeControls() {
  const { isSleepMode, isClosedMode, toggleSleepMode, toggleClosedMode } = useSleepMode()

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Ignore if user is typing in an input
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return
    }

    if (event.key === '0') {
      event.preventDefault()
      toggleSleepMode()
    }

    if (event.key === '9') {
      event.preventDefault()
      toggleClosedMode()
    }
  }, [toggleSleepMode, toggleClosedMode])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown])

  return { isSleepMode, isClosedMode }
}
