import { STAGE_HEIGHT, STAGE_WIDTH } from '../../lib/homography'
import { HOLE_PALETTE, drawBubble, roundRectPath } from './canvas'

/**
 * `dive` (2a, SPEC §6.1): glowing rounded-rectangle rings drift toward the
 * viewer out of the hole, with bubbles coming out. A canvas port of the CSS
 * prototype: perspective 620px with the origin at the hole center.
 */
export const DIVE = {
  rings: 10,
  /** Seconds of phase for one ring to travel the whole depth. */
  period: 20,
  /** CSS perspective distance. */
  P: 620,
  inset: 26,
  radius: 120,
  width: 9,
  colors: HOLE_PALETTE,
  bubbles: Array.from({ length: 10 }, (_, i) => {
    const a = -1.4 + ((i * 2.399 + 1) % 2.8)
    const d = 900 + ((i * 137) % 700)
    return {
      tx: Math.cos(a) * d,
      ty: Math.sin(a) * d * 0.8,
      sc: 1 + ((i * 7) % 10) / 6,
      period: 9 + (i % 5) * 2,
      off: (i * 1.9) % 12,
    }
  }),
} as const

export interface DiveRing {
  k: number
  life: number
  /** Depth: -6000 (far) to 120 (just past the viewer). */
  z: number
  /** Perspective scale around the hole. */
  scale: number
  opacity: number
}

/** Ring opacity over its life: in to .9 by 12%, ease to .8 by 88%, out to 0. */
export function diveRingOpacity(life: number): number {
  if (life < 0.12) return (life / 0.12) * 0.9
  if (life < 0.88) return 0.9 - ((life - 0.12) / 0.76) * 0.1
  return (0.8 * (1 - life)) / 0.12
}

/** Every ring at phase `t`, sorted far to near (draw order). */
export function diveRings(t: number): DiveRing[] {
  const rings: DiveRing[] = []
  for (let k = 0; k < DIVE.rings; k++) {
    const life = (t / DIVE.period + k / DIVE.rings) % 1
    const z = -6000 + 6120 * life
    rings.push({ k, life, z, scale: DIVE.P / (DIVE.P - z), opacity: diveRingOpacity(life) })
  }
  return rings.sort((a, b) => a.z - b.z)
}

export interface DiveBubble {
  /** Offset from the hole center, stage px. */
  dx: number
  dy: number
  radius: number
  opacity: number
}

/** Bubble `i` at phase `t`: eased out of the hole toward the menu side. */
export function diveBubble(i: number, t: number): DiveBubble {
  const b = DIVE.bubbles[i]
  const life = ((t + b.off) / b.period) % 1
  const e = Math.pow(life, 1.6)
  const sc = 0.05 + (b.sc - 0.05) * e
  return {
    dx: b.tx * e,
    dy: b.ty * e,
    radius: 55 * sc,
    opacity: life < 0.15 ? life / 0.15 : 1 - (life - 0.15) / 0.85,
  }
}

export function drawDive(c: CanvasRenderingContext2D, t: number, [hx, hy]: [number, number]) {
  c.fillStyle = '#000'
  c.fillRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT)

  for (const { k, scale: s, opacity: op } of diveRings(t)) {
    const x0 = hx + (DIVE.inset - hx) * s
    const y0 = hy + (DIVE.inset - hy) * s
    const x1 = hx + (STAGE_WIDTH - DIVE.inset - hx) * s
    const y1 = hy + (STAGE_HEIGHT - DIVE.inset - hy) * s
    const col = DIVE.colors[k % 3]
    roundRectPath(c, x0, y0, x1 - x0, y1 - y0, DIVE.radius * s)
    // Glow is a wide faint stroke under the line, never shadowBlur.
    c.lineWidth = DIVE.width * s * 4
    c.strokeStyle = `rgba(${col},${op * 0.18})`
    c.stroke()
    c.lineWidth = Math.max(1, DIVE.width * s)
    c.strokeStyle = `rgba(${col},${op})`
    c.stroke()
  }

  for (let i = 0; i < DIVE.bubbles.length; i++) {
    const b = diveBubble(i, t)
    drawBubble(c, hx + b.dx, hy + b.dy, b.radius, b.opacity)
  }
}
