import { createContext, useContext, useState, useCallback, useMemo } from 'react'
import type { ReactNode } from 'react'
import type { SecondaryScreen, SecondaryScreenKeyMap } from '../types'

// Screen mode: either showing primary menu or a secondary screen
type ScreenMode = 'primary' | 'secondary'

interface ScreenState {
  mode: ScreenMode
  activeScreen: SecondaryScreen | null
  timeoutRemaining: number | null
}

// Type for the timeout setter (supports both value and updater function)
type TimeoutSetter = React.Dispatch<React.SetStateAction<number | null>>

interface ScreenContextValue extends ScreenState {
  // Key map for instant lookup
  keyMap: SecondaryScreenKeyMap
  defaultTimeout: number
  // Actions
  showScreen: (screen: SecondaryScreen) => void
  returnToPrimary: () => void
  setTimeoutRemaining: TimeoutSetter
}

const ScreenContext = createContext<ScreenContextValue | null>(null)

interface ScreenProviderProps {
  children: ReactNode
  secondaryScreens: SecondaryScreen[]
  defaultTimeoutSeconds?: number
  // If there's an active secondary screen from Sanity, use it
  initialActiveScreen?: SecondaryScreen | null
}

export function ScreenProvider({
  children,
  secondaryScreens,
  defaultTimeoutSeconds = 30,
  initialActiveScreen = null,
}: ScreenProviderProps) {
  const [mode, setMode] = useState<ScreenMode>(initialActiveScreen ? 'secondary' : 'primary')
  const [activeScreen, setActiveScreen] = useState<SecondaryScreen | null>(initialActiveScreen)
  const [timeoutRemaining, setTimeoutRemaining] = useState<number | null>(null)

  // Build key map from secondary screens for O(1) lookup
  const keyMap = useMemo<SecondaryScreenKeyMap>(() => {
    const map: SecondaryScreenKeyMap = {}
    for (const screen of secondaryScreens) {
      if (screen.triggerKey) {
        // Normalize to uppercase for consistent matching
        map[screen.triggerKey.toUpperCase()] = screen
      }
    }
    console.log('🗺️ Built key map:', Object.keys(map).join(', '))
    return map
  }, [secondaryScreens])

  const showScreen = useCallback((screen: SecondaryScreen) => {
    console.log('📺 Showing secondary screen:', screen.title, `[${screen.triggerKey}]`)
    setActiveScreen(screen)
    setMode('secondary')
    // Set initial timeout
    const timeout = screen.timeoutSeconds ?? defaultTimeoutSeconds
    setTimeoutRemaining(timeout)
  }, [defaultTimeoutSeconds])

  const returnToPrimary = useCallback(() => {
    console.log('🏠 Returning to primary menu')
    setMode('primary')
    setActiveScreen(null)
    setTimeoutRemaining(null)
  }, [])

  const value: ScreenContextValue = {
    mode,
    activeScreen,
    timeoutRemaining,
    keyMap,
    defaultTimeout: defaultTimeoutSeconds,
    showScreen,
    returnToPrimary,
    setTimeoutRemaining,
  }

  return (
    <ScreenContext.Provider value={value}>
      {children}
    </ScreenContext.Provider>
  )
}

export function useScreenContext(): ScreenContextValue {
  const context = useContext(ScreenContext)
  if (!context) {
    throw new Error('useScreenContext must be used within a ScreenProvider')
  }
  return context
}
