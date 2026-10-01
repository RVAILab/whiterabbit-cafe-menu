import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  clampPoint,
  loadCalibration,
  storeCalibration,
  type Calibration,
} from '../lib/calibration'
import { defaultCorners, type Corners, type Point } from '../lib/homography'
import { CalibrationContext, type CalibrationApi } from './calibrationContext'

const viewportDefault = () => defaultCorners(window.innerWidth, window.innerHeight)

/** A start() that arrives before calibration is available waits this long for it. */
const PENDING_START_MAX_MS = 30_000

export function CalibrationProvider({ children }: { children: ReactNode }) {
  const [calibration, setCalibration] = useState<Calibration | null>(loadCalibration)
  const [draft, setDraft] = useState<Corners | null>(null)
  const [selectedCorner, setSelectedCorner] = useState(0)
  const available = useRef(false)
  const savedCorners = useRef<Corners | null>(calibration?.corners ?? null)
  /** A start() waiting for availability (e.g. the same snapshot switches to the rabbit hole). */
  const pendingStart = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    savedCorners.current = calibration?.corners ?? null
  }, [calibration])

  const clearPendingStart = useCallback(() => {
    if (pendingStart.current !== null) clearTimeout(pendingStart.current)
    pendingStart.current = null
  }, [])
  useEffect(() => clearPendingStart, [clearPendingStart])

  const open = useCallback(() => {
    clearPendingStart()
    setDraft((current) => current ?? (savedCorners.current ?? viewportDefault()).map((p) => [...p]) as Corners)
  }, [clearPendingStart])

  const start = useCallback(() => {
    if (available.current) {
      open()
      return
    }
    clearPendingStart()
    pendingStart.current = setTimeout(() => {
      pendingStart.current = null
      console.warn('Calibration: not available within 30s (rabbit hole layout with a loaded menu); request dropped')
    }, PENDING_START_MAX_MS)
  }, [open, clearPendingStart])

  const cancel = useCallback(() => setDraft(null), [])

  const save = useCallback(() => {
    if (!draft) return
    const next: Calibration = { version: 1, corners: draft, updatedAt: new Date().toISOString() }
    storeCalibration(next)
    setCalibration(next)
    setDraft(null)
  }, [draft])

  const reset = useCallback(() => {
    setDraft((current) => (current ? viewportDefault() : current))
  }, [])

  const setCorner = useCallback((index: number, point: Point) => {
    setDraft((current) => {
      if (!current) return current
      const next = [...current] as Corners
      next[index] = clampPoint(point)
      return next
    })
  }, [])

  const nudge = useCallback((dxPx: number, dyPx: number) => {
    setDraft((current) => {
      if (!current) return current
      const [x, y] = current[selectedCorner]
      const next = [...current] as Corners
      next[selectedCorner] = clampPoint([x + dxPx / window.innerWidth, y + dyPx / window.innerHeight])
      return next
    })
  }, [selectedCorner])

  const selectCorner = useCallback((index: number) => setSelectedCorner(((index % 4) + 4) % 4), [])

  const adopt = useCallback((next: Calibration | null) => setCalibration(next), [])

  const setAvailable = useCallback((next: boolean) => {
    available.current = next
    if (!next) setDraft(null)
    else if (pendingStart.current !== null) open()
  }, [open])

  const api = useMemo<CalibrationApi>(() => ({
    isCalibrating: draft !== null,
    corners: draft ?? calibration?.corners ?? null,
    calibration,
    selectedCorner,
    start,
    cancel,
    save,
    reset,
    selectCorner,
    nudge,
    setCorner,
    adopt,
    setAvailable,
  }), [draft, calibration, selectedCorner, start, cancel, save, reset, selectCorner, nudge, setCorner, adopt, setAvailable])

  return <CalibrationContext.Provider value={api}>{children}</CalibrationContext.Provider>
}
