import { useSleepMode } from '../context/SleepModeContext'
import { ClosedOverlay } from './ClosedOverlay'
import { MassageOverlay } from './MassageOverlay'
import { SleepModeOverlay } from './SleepModeOverlay'

/**
 * The sleep, closed and massage overlays, shared by every projection layout.
 * The clubhouse overlay is not here: it keeps the menu up, so each layout
 * draws it itself (the hole notice, or the board's announcement bar).
 */
export function ProjectorOverlays() {
  const { isSleepMode, isClosedMode, isMassageMode } = useSleepMode()

  return (
    <>
      {/* Sleep mode overlay */}
      {isSleepMode && <SleepModeOverlay />}

      {/* Closed mode overlay */}
      {isClosedMode && <ClosedOverlay />}

      {/* Massage mode overlay — multi-day closure */}
      {isMassageMode && <MassageOverlay />}
    </>
  )
}
