import { STAGE_HEIGHT, STAGE_WIDTH } from '../lib/homography'

/**
 * The featured wall's backdrop: soft green and pink glows drifting most of
 * the time; every cycle they resolve into a light snowfall (faint specks that
 * sharpen into six-armed flakes, drift down, then soften away again). Faint
 * and thin throughout so the menu in front stays easy to read. The stage-edge
 * fade is the .ft-backdrop mask, so nothing meets a hard edge.
 */
export const BACKDROP = {
  /** Seconds per glow → snow → glow cycle. */
  cycle: 150,
  /** Within the cycle: snow eases in, holds, eases out (seconds). */
  snowIn: [80, 100],
  snowOut: [125, 145],
  glows: [
    { x: 520, y: 380, r: 560, color: '110,150,80', alpha: 0.11, period: 97, ax: 140, ay: 90 },
    { x: 1150, y: 700, r: 520, color: '255,61,154', alpha: 0.07, period: 83, ax: 120, ay: 110 },
    { x: 980, y: 230, r: 460, color: '255,61,154', alpha: 0.05, period: 113, ax: 160, ay: 70 },
    { x: 300, y: 830, r: 500, color: '110,150,80', alpha: 0.09, period: 71, ax: 110, ay: 80 },
  ],
  flakes: 16,
  /** Flake line strength at full snow. */
  lineAlpha: 0.22,
} as const

const smooth = (x: number) => {
  const c = Math.min(1, Math.max(0, x))
  return c * c * (3 - 2 * c)
}

/** 0 (glows only) to 1 (crisp snowflakes) at phase `t` seconds. */
export function snowAmount(t: number): number {
  const s = ((t % BACKDROP.cycle) + BACKDROP.cycle) % BACKDROP.cycle
  const [i0, i1] = BACKDROP.snowIn
  const [o0, o1] = BACKDROP.snowOut
  if (s < i0 || s >= o1) return 0
  if (s < i1) return smooth((s - i0) / (i1 - i0))
  if (s < o0) return 1
  return 1 - smooth((s - o0) / (o1 - o0))
}

/** Deterministic per-flake constants (no Math.random: the same wall every load). */
const FLAKES = Array.from({ length: BACKDROP.flakes }, (_, i) => {
  const h = (n: number) => ((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1
  return {
    x: 60 + h(1) * 1380,
    size: 13 + h(2) * 22,
    fall: 18 + h(3) * 22,
    offset: h(4) * (STAGE_HEIGHT + 240),
    sway: 18 + h(5) * 26,
    swayPeriod: 8 + h(6) * 7,
    spin: (h(7) - 0.5) * 0.25,
    color: i % 2 ? '255,196,226' : '206,230,186',
  }
})

export interface FlakePose { x: number; y: number; size: number; angle: number; color: string }

/** Flake `i` at phase `t`: falling, swaying and turning, looping from above the top to below the bottom. */
export function flakePose(i: number, t: number): FlakePose {
  const f = FLAKES[i]
  const span = STAGE_HEIGHT + 240
  return {
    x: f.x + Math.sin((t / f.swayPeriod) * Math.PI * 2 + i) * f.sway,
    y: ((t * f.fall + f.offset) % span) - 120,
    size: f.size,
    angle: t * f.spin + i,
    color: f.color,
  }
}

function strokeFlake(c: CanvasRenderingContext2D, { x, y, size, angle }: FlakePose) {
  c.save()
  c.translate(x, y)
  c.rotate(angle)
  c.beginPath()
  for (let k = 0; k < 6; k++) {
    const a = (k * Math.PI) / 3
    const ux = Math.cos(a)
    const uy = Math.sin(a)
    c.moveTo(0, 0)
    c.lineTo(ux * size, uy * size)
    for (const side of [-1, 1]) {
      const bx = ux * size * 0.55
      const by = uy * size * 0.55
      const ba = a + side * (Math.PI / 3)
      c.moveTo(bx, by)
      c.lineTo(bx + Math.cos(ba) * size * 0.3, by + Math.sin(ba) * size * 0.3)
    }
  }
  c.stroke()
  c.restore()
}

export function drawBackdrop(c: CanvasRenderingContext2D, t: number) {
  c.clearRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT)

  for (const g of BACKDROP.glows) {
    const a = (t / g.period) * Math.PI * 2
    const x = g.x + Math.sin(a) * g.ax
    const y = g.y + Math.cos(a * 0.8) * g.ay
    const grad = c.createRadialGradient(x, y, 0, x, y, g.r)
    grad.addColorStop(0, `rgba(${g.color},${g.alpha})`)
    grad.addColorStop(0.5, `rgba(${g.color},${g.alpha * 0.45})`)
    grad.addColorStop(1, `rgba(${g.color},0)`)
    c.fillStyle = grad
    c.fillRect(x - g.r, y - g.r, g.r * 2, g.r * 2)
  }

  const snow = snowAmount(t)
  if (snow <= 0) return
  c.lineCap = 'round'
  for (let i = 0; i < BACKDROP.flakes; i++) {
    const p = flakePose(i, t)
    // A soft speck while the snow resolves, giving way to the crisp flake.
    const speck = snow * (1 - snow) * 0.9
    if (speck > 0.01) {
      const r = p.size * 1.3
      const grad = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, r)
      grad.addColorStop(0, `rgba(${p.color},${speck * 0.35})`)
      grad.addColorStop(1, `rgba(${p.color},0)`)
      c.fillStyle = grad
      c.fillRect(p.x - r, p.y - r, r * 2, r * 2)
    }
    const line = snow * snow * BACKDROP.lineAlpha
    if (line > 0.005) {
      c.strokeStyle = `rgba(${p.color},${line})`
      c.lineWidth = 1.2 + p.size * 0.035
      strokeFlake(c, p)
    }
  }
}
