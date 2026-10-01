import { useCallback } from 'react'
import { useProjectorKeys } from './useProjectorKeys'
import { useSleepMode } from '../context/SleepModeContext'

/**
 * Hook to handle keyboard controls for overlay modes.
 *
 * Key bindings:
 * - 0: Toggle sleep mode (barista away)
 * - 9: Toggle closed mode (cafe closed for the day)
 * - 8: Toggle massage mode (cafe closed for a few days)
 */
export function useSleepModeControls() {
  const {
    isSleepMode, isClosedMode, isMassageMode,
    toggleSleepMode, toggleClosedMode, toggleMassageMode,
  } = useSleepMode()

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === '0') {
      event.preventDefault()
      toggleSleepMode()
    }

    if (event.key === '9') {
      event.preventDefault()
      toggleClosedMode()
    }

    if (event.key === '8') {
      event.preventDefault()
      toggleMassageMode()
    }
  }, [toggleSleepMode, toggleClosedMode, toggleMassageMode])

  useProjectorKeys(handleKeyDown)

  return { isSleepMode, isClosedMode, isMassageMode }
}
