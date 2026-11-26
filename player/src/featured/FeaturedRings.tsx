import { useEffect, useRef } from 'react'
import { STAGE_HEIGHT, STAGE_WIDTH } from '../lib/homography'
import { drawFeaturedRings } from './rings'

/** Phase seconds per wall second: the rabbit hole's default calm speed, as Portal looks on the wall. */
const SPEED = 0.4

/** The featured wall's background rings, drawn every frame (one still frame under reduced motion). */
export function FeaturedRings() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const still = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    const start = performance.now()
    let frame = 0
    const draw = (now: number) => {
      drawFeaturedRings(ctx, ((now - start) / 1000) * SPEED + 6)
      if (!still) frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [])
  return <canvas ref={canvasRef} className="ft-rings" width={STAGE_WIDTH} height={STAGE_HEIGHT} aria-hidden="true" />
}
