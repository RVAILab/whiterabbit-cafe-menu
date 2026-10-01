/**
 * The gulp (SPEC §7): a framework-free timeline so every trigger — the G key,
 * a menu change, the schedule and a remote effectCommand — goes through one
 * `gulp()` that returns `false` when it refuses.
 *
 * Timers are plain setTimeout and the clock is Date.now, so the whole
 * timeline runs under vitest fake timers.
 */

/** Ms from trigger (SPEC §7.1). */
export const GULP_TIMELINE = {
  /** Content is invisible: a held-back menu is swapped here. */
  swallowedAt: 1300,
  /** `gulping` comes off the stage; the targets spring back; speedTarget 1. */
  releaseAt: 2600,
  /** The spring has settled; a new gulp may start. */
  rearmAt: 4300,
} as const

/** Minimum time between gulp starts, unless the caller passes `ignoreGap` (the G key). */
export const GULP_MIN_GAP_MS = 60_000

/** Hole speed multiplier while swallowing (HoleCanvas `speedTarget`). */
export const GULP_SPEED_TARGET = 5

export type GulpPhase = 'idle' | 'swallowing' | 'returning'

export interface GulpState {
  /** idle → swallowing (0–2600) → returning (2600–4300) → idle. */
  phase: GulpPhase
  /** The stage carries the `gulping` class (phase 'swallowing'). */
  gulping: boolean
  /** A new gulp may start, gap permitting (phase 'idle'). */
  armed: boolean
  /** Date.now() of the last accepted gulp, or null. */
  lastGulpAt: number | null
  /** What the hole should ease toward: 5 while swallowing, else 1. */
  speedTarget: number
}

export interface GulpOptions {
  /** Runs at 1300ms, while the menu is invisible. Runs at most once, even if the gulp is cancelled. */
  onSwallowed?: () => void
  /** Skip the 60s minimum gap (the G key). Every other refusal still applies. */
  ignoreGap?: boolean
}

export interface GulpControllerOptions {
  /**
   * Why a gulp can't start right now (overlay, reduced motion, calibrating,
   * no stage…), or null when it may. Read at trigger time.
   */
  refusal: () => string | null
  /** Runs synchronously on an accepted gulp, before the state flips (measure targets here). */
  onStart?: () => void
}

export interface GulpController {
  gulp(options?: GulpOptions): boolean
  /** Swap the environment hooks (refusal, onStart), e.g. from a React effect. */
  configure(options: GulpControllerOptions): void
  getState(): GulpState
  subscribe(listener: () => void): () => void
  /** Abort a running gulp: a pending onSwallowed runs now, the state returns to idle. */
  cancel(): void
  /** cancel() and drop every listener. */
  destroy(): void
}

const stateFor = (phase: GulpPhase, lastGulpAt: number | null): GulpState => ({
  phase,
  gulping: phase === 'swallowing',
  armed: phase === 'idle',
  lastGulpAt,
  speedTarget: phase === 'swallowing' ? GULP_SPEED_TARGET : 1,
})

const NOT_CONFIGURED: GulpControllerOptions = { refusal: () => 'not configured' }

export function createGulpController(initial: GulpControllerOptions = NOT_CONFIGURED): GulpController {
  let env = initial
  let state = stateFor('idle', null)
  let timers: ReturnType<typeof setTimeout>[] = []
  let pendingSwallow: (() => void) | null = null
  const listeners = new Set<() => void>()

  const setPhase = (phase: GulpPhase, lastGulpAt = state.lastGulpAt) => {
    state = stateFor(phase, lastGulpAt)
    listeners.forEach((listener) => listener())
  }

  const runSwallow = () => {
    const swallow = pendingSwallow
    pendingSwallow = null
    swallow?.()
  }

  const clearTimers = () => {
    timers.forEach(clearTimeout)
    timers = []
  }

  return {
    gulp({ onSwallowed, ignoreGap = false } = {}) {
      if (state.phase !== 'idle') return false
      if (env.refusal() !== null) return false
      const now = Date.now()
      if (!ignoreGap && state.lastGulpAt !== null && now - state.lastGulpAt < GULP_MIN_GAP_MS) return false

      env.onStart?.()
      pendingSwallow = onSwallowed ?? null
      timers = [
        setTimeout(runSwallow, GULP_TIMELINE.swallowedAt),
        setTimeout(() => setPhase('returning'), GULP_TIMELINE.releaseAt),
        setTimeout(() => {
          timers = []
          setPhase('idle')
        }, GULP_TIMELINE.rearmAt),
      ]
      setPhase('swallowing', now)
      return true
    },
    configure(options) {
      env = options
    },
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    cancel() {
      clearTimers()
      runSwallow()
      if (state.phase !== 'idle') setPhase('idle')
    },
    destroy() {
      this.cancel()
      listeners.clear()
    },
  }
}
