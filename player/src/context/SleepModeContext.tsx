import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

type OverlayMode = 'none' | 'sleep' | 'closed' | 'massage'

interface SleepModeContextValue {
  isSleepMode: boolean
  isClosedMode: boolean
  isMassageMode: boolean
  overlayMode: OverlayMode
  toggleSleepMode: () => void
  toggleClosedMode: () => void
  toggleMassageMode: () => void
  setSleepMode: (active: boolean) => void
  setClosedMode: (active: boolean) => void
  setMassageMode: (active: boolean) => void
}

const SleepModeContext = createContext<SleepModeContextValue | null>(null)

interface SleepModeProviderProps {
  children: ReactNode
}

export function SleepModeProvider({ children }: SleepModeProviderProps) {
  const [overlayMode, setOverlayMode] = useState<OverlayMode>('none')

  const isSleepMode = overlayMode === 'sleep'
  const isClosedMode = overlayMode === 'closed'
  const isMassageMode = overlayMode === 'massage'

  const toggleSleepMode = useCallback(() => {
    setOverlayMode(current => {
      const newMode = current === 'sleep' ? 'none' : 'sleep'
      console.log(`😴 Sleep mode: ${newMode === 'sleep' ? 'ON' : 'OFF'}`)
      return newMode
    })
  }, [])

  const toggleClosedMode = useCallback(() => {
    setOverlayMode(current => {
      const newMode = current === 'closed' ? 'none' : 'closed'
      console.log(`🔒 Closed mode: ${newMode === 'closed' ? 'ON' : 'OFF'}`)
      return newMode
    })
  }, [])

  const toggleMassageMode = useCallback(() => {
    setOverlayMode(current => {
      const newMode = current === 'massage' ? 'none' : 'massage'
      console.log(`💆 Massage mode: ${newMode === 'massage' ? 'ON' : 'OFF'}`)
      return newMode
    })
  }, [])

  const setSleepMode = useCallback((active: boolean) => {
    setOverlayMode(active ? 'sleep' : 'none')
    console.log(`😴 Sleep mode set to: ${active ? 'ON' : 'OFF'}`)
  }, [])

  const setClosedMode = useCallback((active: boolean) => {
    setOverlayMode(active ? 'closed' : 'none')
    console.log(`🔒 Closed mode set to: ${active ? 'ON' : 'OFF'}`)
  }, [])

  const setMassageMode = useCallback((active: boolean) => {
    setOverlayMode(active ? 'massage' : 'none')
    console.log(`💆 Massage mode set to: ${active ? 'ON' : 'OFF'}`)
  }, [])

  return (
    <SleepModeContext.Provider value={{
      isSleepMode, isClosedMode, isMassageMode, overlayMode,
      toggleSleepMode, toggleClosedMode, toggleMassageMode,
      setSleepMode, setClosedMode, setMassageMode,
    }}>
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
