import { STAGE_HEIGHT, STAGE_WIDTH } from '../../lib/homography'
import { HOLE_PALETTE, TAU, drawBubble } from './canvas'

/**
 * `vortex` (2b, SPEC §6.2): seven log-spiral arms turning into an elliptical
 * hole, bubbles drawn inward, and a black occluder at the center so the
 * event text sits on clean black. A straight port of the reference's
 * `drawVortex`.
 */
export const VORTEX = {
  arms: 7,
  twist: 1.7,
  spin: 0.45,
  /** y squash; makes the hole elliptical. */
  squash: 0.82,
  colors: HOLE_PALETTE,
  /** Radius of the black center occluder. */
  occluder: 230,
  bubbles: 14,
  /** Seconds of phase for one bubble to fall the whole way in. */
  bubblePeriod: 1 / 0.07,
  /** Arm radius range and step (`r *= step`). */
  rMin: 14,
  rMax: 1700,
  rStep: 1.035,
} as const

export interface VortexBubble {
  /** Offset from the hole center, stage px. */
  dx: number
  dy: number
  radius: number
  opacity: number
}

/** Bubble `i` at phase `t`: spiralling in from 920px out, shrinking and fading. */
export function vortexBubble(i: number, t: number): VortexBubble {
  const life = (t / VORTEX.bubblePeriod + i / VORTEX.bubbles) % 1
  const r = 900 * (1 - life) + 20
  const a = i * 2.4 + life * 7 - t * 0.2
  return {
    dx: Math.cos(a) * r,
    dy: Math.sin(a) * r * VORTEX.squash,
    radius: 6 + 40 * (1 - life),
    opacity: 0.8 * (1 - life),
  }
}

export function drawVortex(c: CanvasRenderingContext2D, t: number, [cx, cy]: [number, number]) {
  const V = VORTEX
  c.fillStyle = '#000'
  c.fillRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT)
  c.lineCap = 'round'

  // About 1,000 short strokes a frame (SPEC §6.2). If the projector can't
  // hold 30fps, batch each arm into alpha buckets or cap the frame rate.
  for (let k = 0; k < V.arms; k++) {
    const col = V.colors[k % 3]
    const base = (k * TAU) / V.arms - t * V.spin
    for (let r = V.rMin; r < V.rMax; r *= V.rStep) {
      const r2 = r * V.rStep
      const a1 = base + V.twist * Math.log(r)
      const a2 = base + V.twist * Math.log(r2)
      c.strokeStyle = `rgba(${col},${Math.min(1, r / 260) * 0.9})`
      c.lineWidth = 1 + r * 0.028
      c.beginPath()
      c.moveTo(cx + Math.cos(a1) * r, cy + Math.sin(a1) * r * V.squash)
      c.lineTo(cx + Math.cos(a2) * r2, cy + Math.sin(a2) * r2 * V.squash)
      c.stroke()
    }
  }

  for (let i = 0; i < V.bubbles; i++) {
    const b = vortexBubble(i, t)
    drawBubble(c, cx + b.dx, cy + b.dy, b.radius, b.opacity)
  }

  const g = c.createRadialGradient(cx, cy, 0, cx, cy, V.occluder)
  g.addColorStop(0, 'rgba(0,0,0,1)')
  g.addColorStop(0.75, 'rgba(0,0,0,.92)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  c.fillStyle = g
  c.beginPath()
  c.arc(cx, cy, V.occluder, 0, TAU)
  c.fill()
}
