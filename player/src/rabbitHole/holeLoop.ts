import type { HoleVariant } from './holeVariants'

/**
 * The one requestAnimationFrame loop that owns the hole canvas (SPEC §6).
 *
 * Framework-free so the gulp, display control and calibration can drive it
 * through `update()` without knowing about frames:
 *
 * - `variant`       which registered variant draws (switching keeps the phase)
 * - `speed`         config speed (`?speed=` / display control), 1 = prototype
 * - `speedTarget`   multiplier the loop eases toward (gulp: 5, then back to 1)
 * - `paused`        stop drawing (overlay, hidden tab, calibration…)
 * - `reducedMotion` phase frozen: one static frame, no loop
 *
 * The loop's state is mirrored on the canvas as `data-hole-state`
 * (`idle` | `running` | `paused` | `static`).
 */
export interface HoleLoopSettings {
  variant: HoleVariant
  speed: number
  speedTarget: number
  paused: boolean
  reducedMotion: boolean
}

export type HoleLoopState = 'idle' | 'running' | 'paused' | 'static'

export interface HoleLoop {
  /** Apply any subset of settings; reconciles the frame loop once. */
  update(settings: Partial<HoleLoopSettings>): void
  readonly state: HoleLoopState
  /** Accumulated phase in seconds (what `draw` receives as `t`). */
  readonly phase: number
  /** Cancel the pending frame; the loop never runs again. */
  destroy(): void
}

/** Longest frame step; a stall (tab switch, GC) never jumps the animation. */
export const MAX_FRAME_DT = 0.1

export interface PhaseState {
  phase: number
  speedMul: number
}

/**
 * One frame of the phase: `speedMul` eases toward `speedTarget` by
 * `min(1, dt*3)`, then `phase += dt * speed * speedMul`, with `dt` capped.
 */
export function stepPhase(
  { phase, speedMul }: PhaseState,
  dtSeconds: number,
  speed: number,
  speedTarget: number,
): PhaseState {
  const dt = Math.min(Math.max(dtSeconds, 0), MAX_FRAME_DT)
  const nextMul = speedMul + (speedTarget - speedMul) * Math.min(1, dt * 3)
  return { phase: phase + dt * speed * nextMul, speedMul: nextMul }
}

export function createHoleLoop(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  initial: Omit<HoleLoopSettings, 'paused' | 'reducedMotion'>,
): HoleLoop {
  const settings: HoleLoopSettings = { ...initial, paused: false, reducedMotion: false }
  let motion: PhaseState = { phase: 0, speedMul: 1 }
  let state: HoleLoopState = 'idle'
  let frameId: number | null = null
  let lastNow: number | null = null
  let destroyed = false

  const draw = () => settings.variant.draw(ctx, motion.phase, settings.variant.holeCenter)

  const frame = (now: number) => {
    frameId = null
    const dt = lastNow == null ? 0 : (now - lastNow) / 1000
    lastNow = now
    motion = stepPhase(motion, dt, settings.speed, settings.speedTarget)
    draw()
    frameId = requestAnimationFrame(frame)
  }

  const stopFrames = () => {
    if (frameId != null) cancelAnimationFrame(frameId)
    frameId = null
    lastNow = null // the first frame after a resume adds no time
  }

  const setState = (next: HoleLoopState) => {
    state = next
    canvas.dataset.holeState = next
  }

  const reconcile = (variantChanged: boolean) => {
    if (destroyed) return
    const next: HoleLoopState = settings.paused ? 'paused' : settings.reducedMotion ? 'static' : 'running'
    if (next === 'running') {
      if (frameId == null) frameId = requestAnimationFrame(frame)
    } else {
      stopFrames()
      // Reduced motion: one readable frame, redrawn only when the variant changes.
      if (next === 'static' && (state !== 'static' || variantChanged)) draw()
    }
    setState(next)
  }

  return {
    update(patch) {
      const variantChanged = patch.variant != null && patch.variant !== settings.variant
      Object.assign(settings, patch)
      reconcile(variantChanged)
    },
    get state() { return state },
    get phase() { return motion.phase },
    destroy() {
      destroyed = true
      stopFrames()
    },
  }
}
