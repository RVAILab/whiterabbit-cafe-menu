import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

interface SleepModeContextValue {
  isSleepMode: boolean
  toggleSleepMode: () => void
  setSleepMode: (active: boolean) => void
}

const SleepModeContext = createContext<SleepModeContextValue | null>(null)

interface SleepModeProviderProps {
  children: ReactNode
}

export function SleepModeProvider({ children }: SleepModeProviderProps) {
  const [isSleepMode, setIsSleepMode] = useState(false)

  const toggleSleepMode = useCallback(() => {
    setIsSleepMode(current => {
      const newValue = !current
      console.log(`😴 Sleep mode: ${newValue ? 'ON' : 'OFF'}`)
      return newValue
    })
  }, [])

  const setSleepMode = useCallback((active: boolean) => {
    setIsSleepMode(active)
    console.log(`😴 Sleep mode set to: ${active ? 'ON' : 'OFF'}`)
  }, [])

  return (
    <SleepModeContext.Provider value={{ isSleepMode, toggleSleepMode, setSleepMode }}>
      {children}
    </SleepModeContext.Provider>
  )
}

export function useSleepMode() {
  const context = useContext(SleepModeContext)
  if (!context) {
    throw new Error('useSleepMode must be used within a SleepModeProvider')
  }
  return context
}
