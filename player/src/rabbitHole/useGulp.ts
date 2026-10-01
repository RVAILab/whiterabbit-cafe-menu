import { useCallback, useEffect, useState, useSyncExternalStore, type RefObject } from 'react'
import { useCalibration } from '../context/calibrationContext'
import { useSleepMode } from '../context/SleepModeContext'
import { useProjectorKeys } from '../hooks/useProjectorKeys'
import { stageCenterOf } from '../lib/stageOffset'
import { createGulpController, type GulpOptions, type GulpState } from './gulpController'
import { getHoleVariant } from './holeVariants'
import './gulp.css'

export interface Gulp extends GulpState {
  /** The one entry point for every trigger; `false` when refused. Stable identity. */
  gulp(options?: GulpOptions): boolean
  /** The controller's state right now, ahead of the rendered `phase` (stable identity). */
  getState(): GulpState
}

interface UseGulpOptions {
  /** The rabbit hole is on screen. Off: every gulp is refused, G is ignored, a running gulp is cancelled. */
  enabled: boolean
  /** RabbitHoleLayout's stage: root of the offset chain and home of the targets and the hic. */
  stageRef: RefObject<HTMLDivElement | null>
}

/**
 * Point every `.rh-gulp-target` at the hole, in stage px, at trigger time
 * (SPEC §7.1). The hole center comes from the variant on the hole canvas
 * (`data-variant`), so whichever variant is drawing is the one that swallows.
 */
function aimTargets(stage: HTMLElement) {
  const variantId = stage.querySelector<HTMLElement>('[data-variant]')?.dataset.variant
  const [hx, hy] = getHoleVariant(variantId ?? null).holeCenter
  for (const target of stage.querySelectorAll<HTMLElement>('.rh-gulp-target')) {
    const [x, y] = stageCenterOf(target, stage)
    const order = Number(target.dataset.gulpOrder ?? 0) || 0
    target.style.setProperty('--dx', `${hx - x}px`)
    target.style.setProperty('--dy', `${hy - y}px`)
    target.style.setProperty('--in-delay', `${+(order * 0.1).toFixed(3)}s`)
    target.style.setProperty('--ret-delay', `${+(order * 0.12).toFixed(3)}s`)
  }
  const hic = stage.querySelector<HTMLElement>('.rh-hic')
  if (hic) {
    hic.style.left = `${hx}px`
    hic.style.top = `${hy}px`
  }
}

const prefersReducedMotion = () =>
  typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

const isGulpKey = (event: KeyboardEvent) =>
  (event.key === 'g' || event.key === 'G') && !event.ctrlKey && !event.metaKey && !event.altKey

/**
 * The gulp for the projector layout (SPEC §7). Call it once (useRabbitHole);
 * pass `stageRef`, `gulping ? 'gulping' : undefined` and `speedTarget` to the
 * layout and hole canvas. The other triggers (menu change, schedule, remote
 * effect command) call `gulp()` from their own hooks.
 *
 * Refused while: running, disabled/no stage, an overlay is up, reduced motion,
 * calibrating, or within 60s of the last gulp (unless `ignoreGap`).
 *
 * The G key gulps with `ignoreGap`. It listens on `document` in the bubble
 * phase, ahead of the other projector keys on `window`: stopping it here keeps
 * a secondary screen assigned G from also firing in the rabbit hole, and the
 * calibration capture listener on `window` still swallows it while calibrating.
 */
export function useGulp({ enabled, stageRef }: UseGulpOptions): Gulp {
  const { overlayMode } = useSleepMode()
  const { isCalibrating } = useCalibration()
  const [controller] = useState(createGulpController)

  // Conditions are read at trigger time, so every trigger sees the current ones.
  useEffect(() => {
    controller.configure({
      refusal: () => {
        if (!enabled) return 'disabled'
        if (!stageRef.current) return 'no stage'
        if (overlayMode !== 'none') return 'overlay'
        if (prefersReducedMotion()) return 'reduced motion'
        if (isCalibrating) return 'calibrating'
        return null
      },
      onStart: () => {
        if (stageRef.current) aimTargets(stageRef.current)
      },
    })
  }, [controller, enabled, overlayMode, isCalibrating, stageRef])
  const state = useSyncExternalStore(controller.subscribe, controller.getState)

  useEffect(() => {
    if (!enabled) controller.cancel()
  }, [enabled, controller])
  useEffect(() => () => controller.cancel(), [controller])

  const onKeyDown = useCallback((event: KeyboardEvent) => {
    if (!isGulpKey(event)) return
    event.preventDefault()
    event.stopPropagation()
    if (!event.repeat) controller.gulp({ ignoreGap: true })
  }, [controller])
  useProjectorKeys(onKeyDown, { enabled, target: 'document' })

  return { ...state, gulp: controller.gulp, getState: controller.getState }
}
