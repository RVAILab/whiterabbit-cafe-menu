import { useEffect, useCallback } from 'react'
import { useVisualization, type VisualizationType } from '../context/VisualizationContext'

/**
 * Visualization keyboard bindings.
 * Maps keys to visualization types.
 */
const VISUALIZATION_KEYS: Record<string, VisualizationType> = {
  '1': 'bubbles',
  // Add more visualizations here as they're created:
  // '2': 'particles',
  // '3': 'waves',
}

/**
 * Hook to handle keyboard controls for visualizations.
 *
 * Key bindings:
 * - 1: Toggle bubbles visualization
 * - (Future: 2-9 for other visualizations)
 */
export function useVisualizationControls() {
  const { toggleVisualization, activeVisualization } = useVisualization()

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Ignore if user is typing in an input
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return
    }

    const vizType = VISUALIZATION_KEYS[event.key]
    if (vizType) {
      event.preventDefault()
      toggleVisualization(vizType)
    }
  }, [toggleVisualization])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown])

  return {
    activeVisualization,
    visualizationKeys: Object.keys(VISUALIZATION_KEYS),
  }
}
