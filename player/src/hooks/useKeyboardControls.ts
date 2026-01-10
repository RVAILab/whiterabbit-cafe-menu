import { useEffect, useCallback } from 'react'
import { useScreenContext } from '../context/ScreenContext'

/**
 * Hook to handle keyboard controls for secondary screens.
 *
 * Key bindings:
 * - A-Z, 0-9: Trigger assigned secondary screen
 * - ESC or Backspace: Return to primary menu
 * - Space: Extend timeout by 30 seconds (when viewing secondary screen)
 */
export function useKeyboardControls() {
  const { mode, keyMap, showScreen, returnToPrimary } = useScreenContext()

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Ignore if user is typing in an input
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return
    }

    const key = event.key.toUpperCase()

    // ESC or Backspace: Return to primary menu
    if (event.key === 'Escape' || event.key === 'Backspace') {
      if (mode === 'secondary') {
        event.preventDefault()
        returnToPrimary()
      }
      return
    }

    // Space: Could be used to extend timeout (handled elsewhere)
    // For now, just prevent default scroll behavior when in secondary mode
    if (event.key === ' ' && mode === 'secondary') {
      event.preventDefault()
      return
    }

    // Check if key matches a secondary screen trigger
    if (keyMap[key]) {
      event.preventDefault()
      const screen = keyMap[key]
      console.log(`⌨️ Key "${key}" pressed, triggering screen: ${screen.title}`)
      showScreen(screen)
    }
  }, [mode, keyMap, showScreen, returnToPrimary])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown])

  // Return info about available keys for potential UI display
  const availableKeys = Object.keys(keyMap).sort()

  return {
    availableKeys,
    mode,
  }
}
