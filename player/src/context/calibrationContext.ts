import { createContext, useContext } from 'react'
import type { Calibration } from '../lib/calibration'
import type { Corners, Point } from '../lib/homography'

/**
 * Corner-pin calibration state for the rabbit hole projection (SPEC §3.3).
 *
 * Consumers:
 * - the pin reads `corners` (draft while calibrating, else saved; null = default fit);
 * - the gulp scheduler (#27) pauses while `isCalibrating`;
 * - server persistence (#28) can `adopt` a server value and subscribe to saves via
 *   `calibration` (its `updatedAt` changes on every save).
 */
export interface CalibrationApi {
  /** Calibration mode is open (grid, handles, calibration keys own the keyboard). */
  isCalibrating: boolean
  /** The corners the pin should use right now: the draft while calibrating, else the saved ones. */
  corners: Corners | null
  /** The saved calibration (applied on boot from localStorage), or null for the default fit. */
  calibration: Calibration | null
  /** Index (0 TL, 1 TR, 2 BR, 3 BL) of the corner the arrows nudge. */
  selectedCorner: number
  /** Open calibration, if the current layout allows it (rabbit hole only). */
  start(): void
  /** Close without saving; the previous corners come back. */
  cancel(): void
  /** Persist the draft and close. */
  save(): void
  /** Draft back to the default letterbox fit (still needs save). */
  reset(): void
  selectCorner(index: number): void
  /** Move the selected corner by viewport px, clamped to the viewport. */
  nudge(dxPx: number, dyPx: number): void
  /** Place a corner at a normalized point (dragging), clamped to 0..1. */
  setCorner(index: number, point: Point): void
  /** Replace the saved calibration without opening the mode (e.g. a server value). */
  adopt(calibration: Calibration | null): void
  /** Whether `start()` may open calibration; set by the projector layout. */
  setAvailable(available: boolean): void
}

const noop = () => {}

export const CalibrationContext = createContext<CalibrationApi>({
  isCalibrating: false,
  corners: null,
  calibration: null,
  selectedCorner: 0,
  start: noop,
  cancel: noop,
  save: noop,
  reset: noop,
  selectCorner: noop,
  nudge: noop,
  setCorner: noop,
  adopt: noop,
  setAvailable: noop,
})

export const useCalibration = () => useContext(CalibrationContext)
