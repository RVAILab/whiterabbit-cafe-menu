import { useEffect, useRef } from 'react'
import { resilientListen } from '../lib/resilientListen'
import { useSleepMode } from '../context/SleepModeContext'
import { useVisualization, type VisualizationType } from '../context/VisualizationContext'
import { useScreenContext } from '../context/ScreenContext'

const VALID_VISUALIZATIONS = ['none', 'bubbles', 'geometric', 'waveforms']

/**
 * Hook to receive remote display commands from the POS via Sanity listener.
 *
 * Listens for changes to the `displayCommand` singleton document in Sanity.
 * When the POS sends a command via the /api/display endpoint, it patches
 * this document, triggering the listener here to dispatch the command
 * to the appropriate React context.
 */
export function useRemoteControl() {
  const { setSleepMode, setClosedMode } = useSleepMode()
  const { setVisualization, setFullscreen } = useVisualization()
  const { showScreen, returnToPrimary, keyMap } = useScreenContext()

  // Stable refs for context methods to avoid re-subscribing
  const handlersRef = useRef({
    setSleepMode,
    setClosedMode,
    setVisualization,
    setFullscreen,
    showScreen,
    returnToPrimary,
    keyMap,
  })
  handlersRef.current = {
    setSleepMode,
    setClosedMode,
    setVisualization,
    setFullscreen,
    showScreen,
    returnToPrimary,
    keyMap,
  }

  useEffect(() => {
    console.log('📡 Remote control: listening for display commands')

    // resilientListen auto-reconnects on error/disconnect and on tab
    // visibility/online, so a dropped listener no longer leaves the projector
    // permanently unresponsive to display commands.
    const stop = resilientListen({
      label: 'Remote control',
      query: '*[_type == "displayCommand" && _id == "displayCommand"]',
      listenOptions: { includeResult: true },
      onEvent: (event: any) => {
        // Only process actual mutations, not welcome/reconnect events
        if (event.type !== 'mutation') return

        const doc = event.result
        if (!doc) return

        const { action, value } = doc
        const h = handlersRef.current

        console.log(`📡 Remote command: ${action} → ${value}`)

        switch (action) {
          case 'overlay':
            if (value === 'sleep') {
              h.setSleepMode(true)
            } else if (value === 'closed') {
              h.setClosedMode(true)
            } else {
              h.setSleepMode(false)
            }
            break

          case 'visualization':
            if (VALID_VISUALIZATIONS.includes(value)) {
              h.setVisualization((value ?? 'none') as VisualizationType)
            }
            break

          case 'visualizationMode':
            // 'fullscreen' takes the visualization over the whole screen
            // (hiding the menu); anything else returns it to the background.
            h.setFullscreen(value === 'fullscreen')
            break

          case 'screen':
            if (value === 'primary' || !value) {
              h.returnToPrimary()
            } else {
              const screen = h.keyMap[value.toUpperCase()]
              if (screen) {
                h.showScreen(screen)
              } else {
                console.warn(`📡 Remote control: no screen found for key "${value}"`)
              }
            }
            break

          default:
            console.warn(`📡 Remote control: unknown action "${action}"`)
        }
      },
    })

    return () => {
      console.log('📡 Remote control: disconnected')
      stop()
    }
  }, []) // Empty deps — handlers accessed via ref
}
