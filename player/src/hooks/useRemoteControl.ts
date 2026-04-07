import { useEffect, useRef } from 'react'
import { client } from '../lib/sanity'
import { useSleepMode } from '../context/SleepModeContext'
import { useVisualization, type VisualizationType } from '../context/VisualizationContext'
import { useScreenContext } from '../context/ScreenContext'

const VALID_VISUALIZATIONS = ['none', 'bubbles', 'geometric', 'waveforms']

/**
 * Hook to receive remote display commands from the POS via Sanity listener.
 *
 * Listens for changes to a `displayCommand` singleton document in Sanity.
 * When the POS sends a command via the /api/display endpoint, it patches
 * this document, triggering the listener here to dispatch the command
 * to the appropriate React context.
 */
export function useRemoteControl() {
  const { setSleepMode, setClosedMode } = useSleepMode()
  const { setVisualization } = useVisualization()
  const { showScreen, returnToPrimary, keyMap } = useScreenContext()

  // Track last processed nonce to deduplicate on reconnect
  const lastNonceRef = useRef<string | null>(null)

  // Stable refs for context methods to avoid re-subscribing
  const handlersRef = useRef({
    setSleepMode,
    setClosedMode,
    setVisualization,
    showScreen,
    returnToPrimary,
    keyMap,
  })
  handlersRef.current = {
    setSleepMode,
    setClosedMode,
    setVisualization,
    showScreen,
    returnToPrimary,
    keyMap,
  }

  useEffect(() => {
    console.log('📡 Remote control: listening for display commands')

    const subscription = client
      .listen('*[_type == "displayCommand"]', {}, { includeResult: true })
      .subscribe({
        next: (event: any) => {
          const doc = event.result
          if (!doc) return

          // Skip if we already processed this command
          if (doc.nonce && doc.nonce === lastNonceRef.current) return
          lastNonceRef.current = doc.nonce ?? null

          const { action, value } = doc
          const h = handlersRef.current

          console.log(`📡 Remote command: ${action} → ${value}`)

          switch (action) {
            case 'overlay':
              h.setSleepMode(value === 'sleep')
              h.setClosedMode(value === 'closed')
              break

            case 'visualization':
              if (VALID_VISUALIZATIONS.includes(value)) {
                h.setVisualization((value ?? 'none') as VisualizationType)
              }
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
        error: (err: any) => {
          console.error('📡 Remote control listener error:', err)
        },
      })

    return () => {
      console.log('📡 Remote control: disconnected')
      subscription.unsubscribe()
    }
  }, []) // Empty deps — handlers accessed via ref
}
