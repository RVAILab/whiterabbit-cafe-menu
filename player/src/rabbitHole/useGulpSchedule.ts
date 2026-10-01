import { useEffect, useRef } from 'react'
import { useCalibration } from '../context/calibrationContext'
import type { GulpOptions } from './gulpController'
import { DEFAULT_GULP_SCHEDULE, nextScheduledGulpDelayMs, type GulpScheduleSettings } from './gulpSchedule'

interface UseGulpScheduleOptions {
  /** `useGulp().gulp` (stable identity). */
  gulp: (options?: GulpOptions) => boolean
  /** The rabbit hole is on screen (the same condition as useGulp's `enabled`). */
  active: boolean
  /** v2 `desired.rabbitHole.gulp`, or null (v1 / URL-only) → DEFAULT_GULP_SCHEDULE. */
  settings: GulpScheduleSettings | null
  /** Jitter source in [0, 1); a test seam. Defaults to Math.random. */
  random?: () => number
}

/**
 * Scheduled gulps (SPEC §7.2 trigger 1, #27): attempt a gulp every
 * intervalMinutes ± 2 min while the rabbit hole is active and `gulp.enabled`.
 *
 * - Each attempt goes through `gulp()`, so the usual refusals apply (overlay,
 *   reduced motion, 60s gap…); a refused attempt is skipped, not retried.
 * - Paused while calibrating; the interval restarts when calibration ends.
 * - A change to enabled / intervalMinutes / active restarts the interval from now.
 */
export function useGulpSchedule({ gulp, active, settings, random = Math.random }: UseGulpScheduleOptions) {
  const { isCalibrating } = useCalibration()
  const { enabled, intervalMinutes } = settings ?? DEFAULT_GULP_SCHEDULE
  const running = active && enabled && !isCalibrating
  const randomRef = useRef(random)

  useEffect(() => {
    randomRef.current = random
  }, [random])

  useEffect(() => {
    if (!running) return
    let timer: ReturnType<typeof setTimeout>
    const schedule = () => {
      timer = setTimeout(() => {
        gulp()
        schedule()
      }, nextScheduledGulpDelayMs(intervalMinutes, randomRef.current))
    }
    schedule()
    return () => clearTimeout(timer)
  }, [running, intervalMinutes, gulp])
}
