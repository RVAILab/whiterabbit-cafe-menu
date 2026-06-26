import { useEffect, useCallback } from 'react'
import { useVisualization, type VisualizationType } from '../context/VisualizationContext'

/**
 * Visualization keyboard bindings.
 * Maps keys to visualization types.
 */
const VISUALIZATION_KEYS: Record<string, VisualizationType> = {
  '1': 'bubbles',
  '2': 'geometric',
  '3': 'waveforms',
}

/**
 * Key that toggles fullscreen takeover for the active visualization.
 * Note: digit keys 0 (sleep) and 9 (closed) are owned by useSleepModeControls,
 * so fullscreen uses a letter to avoid colliding with the overlay shortcuts.
 */
const FULLSCREEN_KEY = 'f'

/**
 * Hook to handle keyboard controls for visualizations.
 *
 * Key bindings:
 * - 1: Toggle bubbles visualization
 * - 2: Toggle geometric visualization
 * - 3: Toggle waveforms visualization
 * - f: Toggle fullscreen takeover (hides the menu; defaults to bubbles if
 *      no visualization is active)
 */
export function useVisualizationControls() {
  const { toggleVisualization, toggleFullscreen, activeVisualization, isFullscreen } =
    useVisualization()

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Ignore if user is typing in an input
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return
    }

    if (event.key === FULLSCREEN_KEY) {
      event.preventDefault()
      toggleFullscreen()
      return
    }

    const vizType = VISUALIZATION_KEYS[event.key]
    if (vizType) {
      event.preventDefault()
      toggleVisualization(vizType)
    }
  }, [toggleVisualization, toggleFullscreen])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown])

  return {
    activeVisualization,
    isFullscreen,
    visualizationKeys: Object.keys(VISUALIZATION_KEYS),
    fullscreenKey: FULLSCREEN_KEY,
  }
}
