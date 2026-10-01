import { useRef, type RefObject } from 'react'
import type { CalibrationApi } from '../context/calibrationContext'
import { useCalibrationControls } from '../hooks/useCalibrationControls'
import type { DisplayControlExtras } from '../lib/displayControl'
import { resolveEffectiveLayout } from '../lib/effectiveLayout'
import { resolveHoleSettings } from '../lib/holeSettings'
import type { ProjectedMenuDocument } from '../lib/projectedMenu'
import { resolveGulpSchedule } from './gulpSchedule'
import type { HoleVariantId } from './holeVariants'
import { useDevHoleVariantKeys } from './useDevHoleVariantKeys'
import { useGulp } from './useGulp'
import { useGulpSchedule } from './useGulpSchedule'
import { useMenuChangeGulp } from './useMenuChangeGulp'
import { useRabbitHoleFallback } from './useRabbitHoleFallback'
import { useRemoteGulp } from './useRemoteGulp'

interface UseRabbitHoleOptions {
  /** The latest projected menu from the poller. */
  document: ProjectedMenuDocument | null | undefined
  /** `location.search`: the URL overrides (layout, variant, speed, gulpEvery, calibrate). */
  search: string
  displayControl: DisplayControlExtras
}

/** Everything the rabbit hole layout needs to render; `active` false means show the standard layout. */
export interface RabbitHole {
  /** The rabbit hole is selected, the menu is loaded, and it has not fallen back (did not fit). */
  active: boolean
  /** The menu to render: a newer one may be held back for the gulp. */
  document: ProjectedMenuDocument | null | undefined
  variant: HoleVariantId
  speed: number
  /** The hole canvas eases toward this (faster while gulping). */
  speedTarget: number
  gulping: boolean
  stageRef: RefObject<HTMLDivElement | null>
  calibration: CalibrationApi
  /** The menu overflows its plates even at the smallest type: fall back to the standard layout. */
  onDoesNotFit(): void
}

/**
 * The rabbit hole's wiring for the projector: which layout is effective,
 * auto-fit fallback, calibration keys, hole variant/speed (URL, display
 * control, dev keys), the gulp and its triggers (G key, menu changes,
 * schedule, remote effect command). Call it once, unconditionally; it is
 * inert while the standard layout shows.
 */
export function useRabbitHole({ document, search, displayControl }: UseRabbitHoleOptions): RabbitHole {
  const layout = resolveEffectiveLayout({ search, desiredLayout: displayControl.layout })
  const fit = useRabbitHoleFallback(document)
  const active = layout === 'rabbit-hole' && !!document && !fit.fellBack

  const calibration = useCalibrationControls({ enabled: active, search })
  const holeSettings = resolveHoleSettings({ search, desired: displayControl.rabbitHole })
  const devVariant = useDevHoleVariantKeys(layout === 'rabbit-hole', holeSettings.variant)

  const stageRef = useRef<HTMLDivElement>(null)
  const gulp = useGulp({ enabled: active, stageRef })
  const shownDocument = useMenuChangeGulp({
    document,
    enabled: layout === 'rabbit-hole' && !fit.fellBack && displayControl.rabbitHole?.gulp.onMenuChange !== false,
    gulp,
  })
  useGulpSchedule({
    gulp: gulp.gulp,
    active,
    settings: resolveGulpSchedule({ search, desired: displayControl.rabbitHole?.gulp ?? null }),
  })
  useRemoteGulp({ gulp: gulp.gulp, command: displayControl.effectCommand })

  return {
    active,
    document: shownDocument,
    variant: devVariant ?? holeSettings.variant,
    speed: holeSettings.speed,
    speedTarget: gulp.speedTarget,
    gulping: gulp.gulping,
    stageRef,
    calibration,
    onDoesNotFit: () => fit.reportDoesNotFit(shownDocument),
  }
}
