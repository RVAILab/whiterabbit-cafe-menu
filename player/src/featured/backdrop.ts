import { STAGE_HEIGHT, STAGE_WIDTH } from '../lib/homography'
import { SNOWFLAKE_DESIGNS, strokeSnowflake } from './snowflakes'

/**
 * The featured wall's backdrop: soft green and pink glows drifting, with a
 * steady snowfall of Nordic flakes (snowflakes.ts) drifting down on the wind in front of them. A flake
 * fades as it passes behind the menu's text (`textFade`), so words stay
 * clean; the stage-edge fade is the .ft-backdrop mask, so nothing meets a
 * hard edge.
 */
export const BACKDROP = {
  glows: [
    { x: 520, y: 380, r: 560, color: '110,150,80', alpha: 0.11, period: 97, ax: 140, ay: 90 },
    { x: 1150, y: 700, r: 520, color: '255,61,154', alpha: 0.07, period: 83, ax: 120, ay: 110 },
    { x: 980, y: 230, r: 460, color: '255,61,154', alpha: 0.05, period: 113, ax: 160, ay: 70 },
    { x: 300, y: 830, r: 500, color: '110,150,80', alpha: 0.09, period: 71, ax: 110, ay: 80 },
  ],
  flakes: 24,
  /** Flake line strength. */
  lineAlpha: 0.45,
} as const

const TAU = Math.PI * 2

/** Deterministic per-flake constants (no Math.random: the same wall every load). */
const FLAKES = Array.from({ length: BACKDROP.flakes }, (_, i) => {
  const h = (n: number) => ((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1
  return {
    x: 60 + h(1) * 1380,
    size: 18 + h(2) * 22,
    fall: 16 + h(3) * 20,
    offset: h(4) * (STAGE_HEIGHT + 240),
    sway: 14 + h(5) * 22,
    swayPeriod: 7 + h(6) * 8,
    /** Mean turn (rad/s), and a slow wobble on it that can stall or reverse the turn. */
    spin: (h(7) - 0.5) * 0.3,
    spinWobble: 0.6 + h(8) * 0.9,
    spinPeriod: 11 + h(9) * 14,
    /** Tumble: the flake tips on an axis in its own plane, so it squashes and recovers. */
    tumblePeriod: 9 + h(10) * 12,
    tumbleAxis: h(11) * Math.PI,
    phase: h(12) * TAU,
    design: Math.floor(h(13) * SNOWFLAKE_DESIGNS.length),
    color: i % 2 ? '255,196,226' : '206,230,186',
  }
})

/** The wind every flake shares: slow gusts back and forth across the wall (stage px). */
export function windShift(t: number): number {
  return 110 * Math.sin((TAU * t) / 61) + 45 * Math.sin((TAU * t) / 29 + 1)
}

export interface FlakePose {
  x: number
  y: number
  size: number
  angle: number
  /** 1 face-on, down to 0.6 when tipped furthest (never edge-on). */
  squash: number
  tumbleAxis: number
  design: number
  color: string
}

/** Flake `i` at phase `t`: drifting down on the wind, swaying, turning and tumbling, looping top to bottom. */
export function flakePose(i: number, t: number): FlakePose {
  const f = FLAKES[i]
  const span = STAGE_HEIGHT + 240
  return {
    x: f.x + windShift(t + f.phase) + Math.sin((TAU * t) / f.swayPeriod + f.phase) * f.sway,
    y: ((t * f.fall + f.offset) % span) - 120 + Math.sin((TAU * t) / 3.7 + f.phase) * 5,
    size: f.size,
    angle: f.phase + t * f.spin + f.spinWobble * Math.sin((TAU * t) / f.spinPeriod + f.phase),
    squash: 0.8 + 0.2 * Math.cos((TAU * t) / f.tumblePeriod + f.phase),
    tumbleAxis: f.tumbleAxis + 0.3 * Math.sin((TAU * t) / 40 + f.phase),
    design: f.design,
    color: f.color,
  }
}

/** A text box on the stage, stage px. */
export interface TextRect { x: number; y: number; w: number; h: number }

/** 1 in open space, easing to 0 as a flake of this size nears or passes behind any text box. */
export function textFade(x: number, y: number, size: number, rects: readonly TextRect[]): number {
  let nearest = Infinity
  for (const r of rects) {
    const dx = Math.max(r.x - x, 0, x - (r.x + r.w))
    const dy = Math.max(r.y - y, 0, y - (r.y + r.h))
    nearest = Math.min(nearest, Math.hypot(dx, dy))
  }
  const k = Math.min(1, Math.max(0, (nearest - size * 0.4) / (size + 14)))
  return k * k * (3 - 2 * k)
}

function drawFlake(c: CanvasRenderingContext2D, p: FlakePose) {
  c.save()
  c.translate(p.x, p.y)
  c.rotate(p.tumbleAxis)
  c.scale(p.squash, 1)
  c.rotate(p.angle - p.tumbleAxis)
  strokeSnowflake(c, p.design, p.size)
  c.restore()
}

export function drawBackdrop(c: CanvasRenderingContext2D, t: number, text: readonly TextRect[] = []) {
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

  c.lineCap = 'round'
  for (let i = 0; i < BACKDROP.flakes; i++) {
    const p = flakePose(i, t)
    const alpha = BACKDROP.lineAlpha * textFade(p.x, p.y, p.size, text)
    if (alpha < 0.01) continue
    c.strokeStyle = `rgba(${p.color},${alpha})`
    c.fillStyle = `rgba(${p.color},${alpha})`
    drawFlake(c, p)
  }
}
