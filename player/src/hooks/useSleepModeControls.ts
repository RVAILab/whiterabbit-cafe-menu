import { useEffect, useCallback } from 'react'
import { useSleepMode } from '../context/SleepModeContext'

/**
 * Hook to handle keyboard controls for sleep mode.
 *
 * Key bindings:
 * - 0: Toggle sleep mode
 */
export function useSleepModeControls() {
  const { isSleepMode, toggleSleepMode } = useSleepMode()

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Ignore if user is typing in an input
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return
    }

    if (event.key === '0') {
      event.preventDefault()
      toggleSleepMode()
    }
  }, [toggleSleepMode])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown])

  return { isSleepMode }
}
