import { useEffect, useRef } from 'react'
import { STAGE_HEIGHT, STAGE_WIDTH } from '../lib/homography'
import { drawBackdrop } from './backdrop'

/** The featured wall's glows-and-snow backdrop (backdrop.ts); one still frame under reduced motion. */
export function FeaturedBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const still = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    const start = performance.now()
    let frame = 0
    const draw = (now: number) => {
      drawBackdrop(ctx, (now - start) / 1000)
      if (!still) frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [])
  return <canvas ref={canvasRef} className="ft-backdrop" width={STAGE_WIDTH} height={STAGE_HEIGHT} aria-hidden="true" />
}
