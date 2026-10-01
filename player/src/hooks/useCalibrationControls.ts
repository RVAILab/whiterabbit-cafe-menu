import { useEffect } from 'react'
import { useCalibration } from '../context/calibrationContext'
import { useScreenContext } from '../context/ScreenContext'

/** Projector keys reserved by the rabbit hole (C calibrate, G gulp). */
const RESERVED_PROJECTOR_KEYS = ['C', 'G']

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
}

/**
 * Calibration entry and keys for the projector (SPEC §3.3).
 *
 * `enabled` is true only in the rabbit hole layout: the standard layout is not
 * pinned in v1, so there C stays an ordinary (secondary-screen) key and
 * `?calibrate=1` / the `calibrate` screen command are ignored.
 *
 * Key precedence: the listener is registered on `window` in the capture phase,
 * so it runs before every other projector key hook (they all listen on window
 * in the bubble phase). While calibrating it consumes every keydown with
 * `stopPropagation()`, so Esc cannot return to the primary screen and 0/8/9,
 * 1/2/3, F and secondary-screen keys never fire. C also stops propagation, so
 * a secondary screen assigned C cannot fire in the rabbit hole.
 */
export function useCalibrationControls({ enabled, search }: { enabled: boolean; search: string }) {
  const calibration = useCalibration()
  const { setAvailable, start } = calibration
  const { keyMap } = useScreenContext()

  useEffect(() => {
    setAvailable(enabled)
    if (enabled && new URLSearchParams(search).get('calibrate') === '1') start()
  }, [enabled, search, setAvailable, start])

  useEffect(() => () => setAvailable(false), [setAvailable])

  useEffect(() => {
    const taken = RESERVED_PROJECTOR_KEYS.filter((key) => keyMap[key])
    if (taken.length > 0) {
      console.warn(
        `Projector key map: secondary screen(s) assigned ${taken.join(', ')}; ` +
          'those keys are reserved for calibration (C) and the gulp (G) in the rabbit hole layout.',
      )
    }
  }, [keyMap])

  const { isCalibrating, selectedCorner, selectCorner, nudge, reset, save, cancel } = calibration

  useEffect(() => {
    if (!enabled) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return

      if (!isCalibrating) {
        if ((event.key === 'c' || event.key === 'C') && !event.ctrlKey && !event.metaKey && !event.altKey) {
          event.preventDefault()
          event.stopPropagation()
          start()
        }
        return
      }

      // Calibrating: these keys own the keyboard.
      event.stopPropagation()
      event.stopImmediatePropagation()
      const arrow = ARROWS[event.key]
      if (arrow) {
        event.preventDefault()
        const step = event.shiftKey ? 10 : 1
        nudge(arrow[0] * step, arrow[1] * step)
      } else if (event.key === 'Tab') {
        event.preventDefault()
        selectCorner(selectedCorner + (event.shiftKey ? -1 : 1))
      } else if (event.key === 'r' || event.key === 'R') {
        event.preventDefault()
        reset()
      } else if (event.key === 'Enter') {
        event.preventDefault()
        save()
      } else if (event.key === 'Escape') {
        event.preventDefault()
        cancel()
      }
    }

    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true })
  }, [enabled, isCalibrating, selectedCorner, selectCorner, nudge, reset, save, cancel, start])

  return calibration
}
