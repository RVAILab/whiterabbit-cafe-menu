import { useRef, type PointerEvent } from 'react'
import type { CalibrationApi } from '../context/calibrationContext'
import type { Corners } from '../lib/homography'

const CORNER_NAMES = ['top left', 'top right', 'bottom right', 'bottom left']

/** Stage-space grid (z 6): 120px squares, a 6px border and a 240px center circle. Warps with the pin. */
export function CalibrationGrid() {
  return (
    <div className="rh-calgrid" data-testid="calibration-grid">
      <div className="rh-calgrid-circle" />
    </div>
  )
}

interface CalibrationHandlesProps {
  corners: Corners
  selectedCorner: number
  onSelect: CalibrationApi['selectCorner']
  onMove: CalibrationApi['setCorner']
}

/** Viewport-space handles and help card (outside the pin, unwarped). */
export function CalibrationHandles({ corners, selectedCorner, onSelect, onMove }: CalibrationHandlesProps) {
  const dragging = useRef<number | null>(null)

  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (dragging.current === null) return
    onMove(dragging.current, [event.clientX / window.innerWidth, event.clientY / window.innerHeight])
  }
  const end = () => { dragging.current = null }

  return (
    <div className="rh-calibration">
      {corners.map(([x, y], i) => (
        <div
          key={i}
          className={i === selectedCorner ? 'rh-calhandle rh-calhandle-selected' : 'rh-calhandle'}
          data-testid={`calibration-handle-${i}`}
          aria-label={`${CORNER_NAMES[i]} corner`}
          aria-selected={i === selectedCorner}
          role="option"
          style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
          onPointerDown={(event) => {
            onSelect(i)
            dragging.current = i
            event.currentTarget.setPointerCapture?.(event.pointerId)
          }}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
        />
      ))}
      <div className="rh-calhelp" data-testid="calibration-help">
        <p><strong>Calibrate the projection</strong></p>
        <ol>
          <li>Push the projector&rsquo;s own keystone and zoom as far as they help.</li>
          <li>Drag each corner inward until the grid squares look square and the content sits fully on the wall.</li>
          <li>Check from the counter and the door: squares square, text lines horizontal.</li>
          <li>Press Enter.</li>
        </ol>
        <p>Tab / Shift+Tab: next corner · Arrows: nudge (Shift ×10) · R: reset · Enter: save · Esc: cancel</p>
      </div>
    </div>
  )
}
