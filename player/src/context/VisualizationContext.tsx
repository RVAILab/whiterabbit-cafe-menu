import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

export type VisualizationType = 'none' | 'bubbles' | 'geometric' | 'waveforms'

interface VisualizationContextValue {
  activeVisualization: VisualizationType
  setVisualization: (type: VisualizationType) => void
  toggleVisualization: (type: VisualizationType) => void
  isActive: (type: VisualizationType) => boolean
}

const VisualizationContext = createContext<VisualizationContextValue | null>(null)

interface VisualizationProviderProps {
  children: ReactNode
}

export function VisualizationProvider({ children }: VisualizationProviderProps) {
  const [activeVisualization, setActiveVisualization] = useState<VisualizationType>('none')

  const setVisualization = useCallback((type: VisualizationType) => {
    setActiveVisualization(type)
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

  return (
    <VisualizationContext.Provider
      value={{
        activeVisualization,
        setVisualization,
        toggleVisualization,
        isActive,
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
