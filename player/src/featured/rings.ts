import { STAGE_HEIGHT, STAGE_WIDTH } from '../lib/homography'
import { HOLE_PALETTE, roundRectPath } from '../rabbitHole/variants/canvas'
import { DIVE, diveRings } from '../rabbitHole/variants/dive'

/** Where the rings come from: behind the drinks, between the coffee block and the grid. */
export const RINGS_CENTER: [number, number] = [760, 540]
/** The whole layer's strength: rings sit behind text, so they stay faint. */
const STRENGTH = 0.32

/** 1 while a ring is small, easing to 0 as it grows out to the stage edges. */
export function edgeFade(scale: number): number {
  const x = Math.min(1, Math.max(0, (scale - 0.3) / 0.65))
  return 1 - x * x * (3 - 2 * x)
}

/**
 * The rabbit hole's Dive rings (same shapes, palette and motion, no bubbles)
 * on a transparent canvas, fading out toward the edges. `t` is phase seconds.
 */
export function drawFeaturedRings(c: CanvasRenderingContext2D, t: number, [hx, hy] = RINGS_CENTER) {
  c.clearRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT)
  for (const { k, scale: s, opacity } of diveRings(t)) {
    const op = opacity * edgeFade(s) * STRENGTH
    if (op <= 0.003) continue
    const x0 = hx + (DIVE.inset - hx) * s
    const y0 = hy + (DIVE.inset - hy) * s
    const x1 = hx + (STAGE_WIDTH - DIVE.inset - hx) * s
    const y1 = hy + (STAGE_HEIGHT - DIVE.inset - hy) * s
    const col = HOLE_PALETTE[k % 3]
    roundRectPath(c, x0, y0, x1 - x0, y1 - y0, DIVE.radius * s)
    c.lineWidth = DIVE.width * s * 4
    c.strokeStyle = `rgba(${col},${op * 0.18})`
    c.stroke()
    c.lineWidth = Math.max(1, DIVE.width * s)
    c.strokeStyle = `rgba(${col},${op})`
    c.stroke()
  }
}
