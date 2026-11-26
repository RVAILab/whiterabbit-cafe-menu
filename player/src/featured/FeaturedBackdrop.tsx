import { useEffect, useRef } from 'react'
import { STAGE_HEIGHT, STAGE_WIDTH } from '../lib/homography'
import { drawBackdrop, type TextRect } from './backdrop'

/** The menu's text, which flakes fade behind. Photos and the food capsule are opaque, so not listed. */
const TEXT = '.ft-lbl, .ft-nm, .ft-pr, .ft-desc, .ft-next, .ft-foot-msg, .ft-clock'

/** Each text box in stage px: offsets up to the stage, which the corner pin's transform does not affect. */
function textRects(stage: HTMLElement): TextRect[] {
  return [...stage.querySelectorAll<HTMLElement>(TEXT)].map((el) => {
    let x = 0
    let y = 0
    for (let n: HTMLElement | null = el; n && n !== stage; n = n.offsetParent as HTMLElement | null) {
      x += n.offsetLeft
      y += n.offsetTop
    }
    return { x, y, w: el.offsetWidth, h: el.offsetHeight }
  })
}

/** The featured wall's glows-and-snow backdrop (backdrop.ts); one still frame under reduced motion. */
export function FeaturedBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const stage = canvas.closest<HTMLElement>('.rh-stage')
    const still = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    const start = performance.now()
    let text: TextRect[] = []
    let measured = -Infinity
    let frame = 0
    const draw = (now: number) => {
      // The menu changes rarely; re-measure its text every few seconds.
      if (stage && now - measured > 3000) {
        text = textRects(stage)
        measured = now
      }
      drawBackdrop(ctx, (now - start) / 1000, text)
      if (!still) frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [])
  return <canvas ref={canvasRef} className="ft-backdrop" width={STAGE_WIDTH} height={STAGE_HEIGHT} aria-hidden="true" />
}
