import { useEffect, useRef, useSyncExternalStore } from 'react'
import { useSleepMode } from '../context/SleepModeContext'
import { STAGE_HEIGHT, STAGE_WIDTH } from '../lib/homography'
import { createHoleLoop, type HoleLoop } from './holeLoop'
import { getHoleVariant, type HoleVariantId } from './holeVariants'

export interface HoleCanvasProps {
  /** Registered variant id (see `holeVariants`). */
  variant: HoleVariantId
  /** Config speed, 1 = prototype speed (`resolveHoleSettings`). */
  speed: number
  /** Speed multiplier the loop eases toward; the gulp sets 5, then 1. Default 1. */
  speedTarget?: number
  /** Extra pause (e.g. calibration). Overlays and a hidden tab always pause. */
  paused?: boolean
}

const subscribeVisibility = (onChange: () => void) => {
  document.addEventListener('visibilitychange', onChange)
  return () => document.removeEventListener('visibilitychange', onChange)
}
const isTabHidden = () => document.visibilityState === 'hidden'

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'
const reducedMotionQuery = () =>
  typeof window.matchMedia === 'function' ? window.matchMedia(REDUCED_MOTION) : null
const subscribeReducedMotion = (onChange: () => void) => {
  const query = reducedMotionQuery()
  query?.addEventListener('change', onChange)
  return () => query?.removeEventListener('change', onChange)
}
const prefersReducedMotion = () => reducedMotionQuery()?.matches ?? false

/**
 * The hole background: one 1920×1080 canvas (stage resolution, not viewport)
 * driven by the hole loop. Goes in RabbitHoleLayout's `background` slot.
 */
export function HoleCanvas({ variant, speed, speedTarget = 1, paused = false }: HoleCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const loopRef = useRef<HoleLoop | null>(null)
  const { overlayMode } = useSleepMode()
  const hidden = useSyncExternalStore(subscribeVisibility, isTabHidden)
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, prefersReducedMotion)

  // One loop per mount; settings flow in through the effect below.
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const loop = createHoleLoop(canvas, ctx, {
      variant: getHoleVariant(null),
      speed: 0,
      speedTarget: 1,
    })
    loopRef.current = loop
    return () => {
      loop.destroy()
      loopRef.current = null
    }
  }, [])

  useEffect(() => {
    loopRef.current?.update({
      variant: getHoleVariant(variant),
      speed,
      speedTarget,
      paused: paused || hidden || overlayMode !== 'none',
      reducedMotion,
    })
  }, [variant, speed, speedTarget, paused, hidden, overlayMode, reducedMotion])

  return (
    <canvas
      ref={canvasRef}
      className="rh-hole-canvas"
      width={STAGE_WIDTH}
      height={STAGE_HEIGHT}
      data-testid="rabbit-hole-canvas"
      data-variant={variant}
      aria-hidden="true"
    />
  )
}
