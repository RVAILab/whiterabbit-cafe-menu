import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

export type VisualizationType = 'none' | 'bubbles' | 'geometric' | 'waveforms'

/**
 * Display mode for the active visualization.
 * - `background`: visualization sits behind the menu content (default)
 * - `fullscreen`: visualization takes over the whole screen, hiding the menu
 */
export type VisualizationMode = 'background' | 'fullscreen'

/** Fallback visualization used when entering fullscreen with nothing active. */
const DEFAULT_FULLSCREEN_VISUALIZATION: VisualizationType = 'bubbles'

interface VisualizationContextValue {
  activeVisualization: VisualizationType
  setVisualization: (type: VisualizationType) => void
  toggleVisualization: (type: VisualizationType) => void
  isActive: (type: VisualizationType) => boolean
  /** Whether the active visualization covers the menu entirely. */
  isFullscreen: boolean
  setFullscreen: (value: boolean) => void
  toggleFullscreen: () => void
}

const VisualizationContext = createContext<VisualizationContextValue | null>(null)

interface VisualizationProviderProps {
  children: ReactNode
}

export function VisualizationProvider({ children }: VisualizationProviderProps) {
  const [activeVisualization, setActiveVisualization] = useState<VisualizationType>('none')
  const [isFullscreen, setIsFullscreen] = useState(false)

  const setVisualization = useCallback((type: VisualizationType) => {
    setActiveVisualization(type)
    // Leaving the visualization entirely also exits fullscreen takeover.
    if (type === 'none') {
      setIsFullscreen(false)
    }
    console.log(`🎨 Visualization set to: ${type}`)
  }, [])

  const toggleVisualization = useCallback((type: VisualizationType) => {
    setActiveVisualization(current => {
      const newValue = current === type ? 'none' : type
      console.log(`🎨 Visualization toggled: ${current} → ${newValue}`)
      return newValue
    })
  }, [])

  const isActive = useCallback((type: VisualizationType) => {
    return activeVisualization === type
  }, [activeVisualization])

  const setFullscreen = useCallback((value: boolean) => {
    setIsFullscreen(value)
    // Entering fullscreen with nothing active falls back to a default viz so
    // the takeover always shows something rather than a blank screen.
    if (value) {
      setActiveVisualization(current =>
        current === 'none' ? DEFAULT_FULLSCREEN_VISUALIZATION : current
      )
    }
    console.log(`🎨 Visualization fullscreen: ${value}`)
  }, [])

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(current => {
      const next = !current
      if (next) {
        setActiveVisualization(viz =>
          viz === 'none' ? DEFAULT_FULLSCREEN_VISUALIZATION : viz
        )
      }
      console.log(`🎨 Visualization fullscreen toggled: ${current} → ${next}`)
      return next
    })
  }, [])

  return (
    <VisualizationContext.Provider
      value={{
        activeVisualization,
        setVisualization,
        toggleVisualization,
        isActive,
        isFullscreen,
        setFullscreen,
        toggleFullscreen,
      }}
    >
      {children}
    </VisualizationContext.Provider>
  )
}

export function useVisualization() {
  const context = useContext(VisualizationContext)
  if (!context) {
    throw new Error('useVisualization must be used within a VisualizationProvider')
  }
  return context
}
