import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  clampPoint,
  loadCalibration,
  storeCalibration,
  type Calibration,
} from '../lib/calibration'
import { defaultCorners, type Corners, type Point } from '../lib/homography'
import { CalibrationContext, type CalibrationApi } from './calibrationContext'

const viewportDefault = () => defaultCorners(window.innerWidth, window.innerHeight)

export function CalibrationProvider({ children }: { children: ReactNode }) {
  const [calibration, setCalibration] = useState<Calibration | null>(loadCalibration)
  const [draft, setDraft] = useState<Corners | null>(null)
  const [selectedCorner, setSelectedCorner] = useState(0)
  const available = useRef(false)

  const start = useCallback(() => {
    if (!available.current) return
    setDraft((current) => current ?? (calibration?.corners ?? viewportDefault()).map((p) => [...p]) as Corners)
  }, [calibration])

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
  }, [])

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
