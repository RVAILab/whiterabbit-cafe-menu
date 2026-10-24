import { STAGE_HEIGHT, STAGE_WIDTH } from '../../lib/homography'
import { TAU } from './canvas'

/**
 * `upside-down` (Halloween): a red storm boils above the hole, a Mind
 * Flayer's shadow roams the storm, its legs trailing through the clouds and
 * out under the menu,
 * lightning cracks above the event now and then, and ash drifts up the wall.
 *
 * A projector only adds light, so the dark legs are holes cut in the storm:
 * on a lit wall they read as bare wall showing through. The clouds are value
 * noise rendered once and drifted; storm, glow and legs are composed at half
 * resolution (they are all soft) and faded out before every stage edge, so
 * the projected rectangle never lights up.
 */
export const UPSIDE_DOWN = {
  /** Cloud texture size; drawn ×2 across the stage and wrapping horizontally. */
  tex: [960, 540] as [number, number],
  /** Largest noise cell (texture px); halves each octave. */
  cell: 120,
  octaves: 6,
  /** Stage px per second of phase: the storm drifts right, the churn left. */
  drift: [14, -9] as [number, number],
  /** Storm color from thin cloud to its brightest billows. */
  storm: [[110, 6, 10], [255, 74, 52]] as [number, number, number][],
  /** Where the glow and the legs gather, from the hole center (above the event). */
  heart: [0, -308] as [number, number],
  /**
   * The heart wanders from there: right across the storm and back over `period[0]`
   * seconds of phase (to `span[0]` px, with a `wobble` px side sway every
   * `period[2]`), and up and down `span[1]` px every `period[1]`. Kept left of
   * where the storm thins out, and above the black under the event.
   */
  roam: { span: [700, 70], wobble: 120, period: [97, 53, 41], trail: 3 },
  glowRadius: 430,
  /** The storm's reach from just above the hole. */
  reach: 1350,
  /** Black under the event text, as vortex and portal. */
  occluder: 230,
  /** Distance over which everything fades out at each stage edge. */
  edgeFade: 180,
  /** One strike somewhere in each window of this many seconds. */
  lightningEvery: 11,
  spores: 70,
  /**
   * The legs: control point and tip, from the heart. Two reach off the left
   * edge, two run out under the menu.
   */
  legs: [
    [[-230, -172], [-380, 528]],
    [[-130, -242], [-360, 118]],
    [[260, -212], [680, 428]],
    [[460, -102], [1080, 688]],
    [[170, -272], [480, 18]],
    [[-180, -92], [-420, 348]],
  ] as [[number, number], [number, number]][],
}

const frac = (x: number) => x - Math.floor(x)
const mod = (a: number, b: number) => ((a % b) + b) % b
const hash = (n: number) => frac(Math.sin(n * 127.1) * 43758.5453)
const hash2 = (i: number, j: number, seed: number) => frac(Math.sin(i * 127.1 + j * 311.7 + seed * 74.7) * 43758.5453)
const clamp01 = (x: number) => Math.max(0, Math.min(1, x))

function lattice(x: number, y: number, period: number, seed: number) {
  const x0 = Math.floor(x), y0 = Math.floor(y)
  const fx = x - x0, fy = y - y0
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy)
  const v = (i: number, j: number) => hash2(mod(i, period), j, seed)
  const top = v(x0, y0) + (v(x0 + 1, y0) - v(x0, y0)) * sx
  const bottom = v(x0, y0 + 1) + (v(x0 + 1, y0 + 1) - v(x0, y0 + 1)) * sx
  return top + (bottom - top) * sy
}

/** Fractal value noise in [0, 1] at texture px, wrapping every `tex[0]` in x. */
export function stormNoise(x: number, y: number, seed: number): number {
  const { cell, octaves, tex } = UPSIDE_DOWN
  let sum = 0, norm = 0, amp = 0.5
  for (let o = 0; o < octaves; o++) {
    const size = cell / 2 ** o
    sum += amp * lattice(x / size, y / size, tex[0] / size, seed + o * 101)
    norm += amp
    amp *= 0.5
  }
  return sum / norm
}

export interface Strike {
  /** Which strike (seeds the bolt's shape). */
  strike: number
  /** 0–1: a flash, a flicker, a second flash, then a fade. */
  intensity: number
}

/** The lightning at phase `t`, or null between strikes. */
export function lightningAt(t: number): Strike | null {
  const k = Math.floor(t / UPSIDE_DOWN.lightningEvery)
  const s = t - (k * UPSIDE_DOWN.lightningEvery + 2 + hash(k) * 6)
  if (s < 0 || s > 0.5) return null
  const intensity = s < 0.07 ? 1 : s < 0.13 ? 0.25 : s < 0.22 ? 0.85 : 0.85 * (1 - (s - 0.22) / 0.28)
  return { strike: k, intensity }
}

/** A jagged bolt from near the stage top to just above the event, seeded by `strike`. */
export function boltPoints(strike: number, [cx, cy]: [number, number]): [number, number][] {
  const segments = 22
  const top = cy - 430, bottom = cy - 140
  let x = cx + (hash(strike * 3 + 1) - 0.5) * 260
  const points: [number, number][] = []
  for (let i = 0; i <= segments; i++) {
    // big kinks every few steps, fine crackle between them
    const y = top + ((bottom - top) * i) / segments + (i % segments ? (hash(strike * 17 + i) - 0.5) * 8 : 0)
    points.push([x, y])
    x += (hash(strike * 31 + i) - 0.5) * (i % 4 === 0 ? 46 : 14) + (cx - x) * 0.04
  }
  return points
}

export interface Spore {
  x: number
  y: number
  radius: number
  opacity: number
}

/** Ash mote `i` at phase `t`: rising, wandering, wrapping round the stage. */
export function sporeAt(i: number, t: number): Spore {
  const rise = 10 + 22 * hash(i + 71)
  return {
    x: mod(hash(i) * STAGE_WIDTH + Math.sin(t * 0.3 + i) * 30 + t * 4, STAGE_WIDTH),
    y: mod(hash(i + 500) * STAGE_HEIGHT - t * rise, STAGE_HEIGHT + 40) - 20,
    radius: 1.2 + 2.8 * hash(i + 33),
    opacity: 0.15 + 0.35 * hash(i + 44),
  }
}

/** The heart (body, glow and the legs' root) at phase `t`, in stage px, for a hole at (cx, cy). */
export function heartAt(t: number, [cx, cy]: [number, number]): [number, number] {
  const { heart: [dx, dy], roam: { span, wobble, period } } = UPSIDE_DOWN
  return [
    cx + dx + (span[0] * (1 - Math.cos((t * TAU) / period[0]))) / 2 + wobble * Math.sin((t * TAU) / period[2]),
    cy + dy + span[1] * Math.sin((t * TAU) / period[1]),
  ]
}

/**
 * Leg `i`'s control point and tip at phase `t`, in stage px: a slow, uneven
 * reach, dragged back against `velocity` (stage px per second of phase) so the
 * legs trail as the heart moves.
 */
export function legPose(i: number, t: number, [hx, hy]: [number, number], [vx, vy]: [number, number] = [0, 0]) {
  const [[cdx, cdy], [tdx, tdy]] = UPSIDE_DOWN.legs[i]
  const phase = t * 0.13 * (1 + i * 0.17) + i * 1.7
  const reach = 1 + 0.04 * Math.sin((t * TAU) / 23)
  const trail = UPSIDE_DOWN.roam.trail
  const sx = Math.sin(phase) * 40 - vx * trail, sy = Math.cos(phase) * 25 - vy * trail
  return {
    ctrl: [hx + cdx * reach + sx / 2, hy + cdy * reach + sy / 2] as [number, number],
    tip: [hx + tdx * reach + sx, hy + tdy * reach + sy] as [number, number],
  }
}

/* ---------- rendered once ---------- */

interface Assets {
  storm: HTMLCanvasElement
  churn: HTMLCanvasElement
  mask: HTMLCanvasElement
  work: HTMLCanvasElement
  w: CanvasRenderingContext2D
  dot: HTMLCanvasElement
}

const WORK_SCALE = 0.5
let assets: Assets | null | undefined
let assetsFor = ''

function canvas2d(width: number, height: number) {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  return ctx ? { canvas, ctx } : null
}

/** A cloud texture: noise to alpha (`gain·n + bias`), shaded from `colors[0]` to `colors[1]` as it thickens. */
function cloudTexture(seed: number, colors: [number, number, number][], gain: number, bias: number) {
  const [w, h] = UPSIDE_DOWN.tex
  const made = canvas2d(w, h)
  if (!made) return null
  const img = made.ctx.createImageData(w, h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const a = clamp01(gain * stormNoise(x, y, seed) + bias)
      const [lo, hi] = [colors[0], colors[colors.length - 1]]
      img.data[i] = lo[0] + (hi[0] - lo[0]) * a
      img.data[i + 1] = lo[1] + (hi[1] - lo[1]) * a
      img.data[i + 2] = lo[2] + (hi[2] - lo[2]) * a
      img.data[i + 3] = 255 * a
    }
  }
  made.ctx.putImageData(img, 0, 0)
  return made.canvas
}

/** Opaque where the storm may show, fading to nothing toward its reach and every stage edge. */
function reachMask([cx, cy]: [number, number]) {
  const made = canvas2d(STAGE_WIDTH * WORK_SCALE, STAGE_HEIGHT * WORK_SCALE)
  if (!made) return null
  const m = made.ctx
  m.scale(WORK_SCALE, WORK_SCALE)
  const g = m.createRadialGradient(cx, cy - 200, 0, cx, cy - 200, UPSIDE_DOWN.reach)
  g.addColorStop(0, '#000')
  g.addColorStop(0.3, 'rgba(0,0,0,.75)')
  g.addColorStop(1, 'rgba(0,0,0,.05)')
  m.fillStyle = g
  m.fillRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT)
  const fade = UPSIDE_DOWN.edgeFade
  const across = (length: number, horizontal: boolean) => {
    const e = horizontal ? m.createLinearGradient(0, 0, length, 0) : m.createLinearGradient(0, 0, 0, length)
    e.addColorStop(0, 'rgba(0,0,0,0)')
    e.addColorStop(fade / length, '#000')
    e.addColorStop(1 - fade / length, '#000')
    e.addColorStop(1, 'rgba(0,0,0,0)')
    return e
  }
  m.globalCompositeOperation = 'destination-in'
  m.fillStyle = across(STAGE_WIDTH, true)
  m.fillRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT)
  m.fillStyle = across(STAGE_HEIGHT, false)
  m.fillRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT)
  return made.canvas
}

function softDot() {
  const made = canvas2d(16, 16)
  if (!made) return null
  const g = made.ctx.createRadialGradient(8, 8, 0, 8, 8, 8)
  g.addColorStop(0, 'rgba(226,196,186,1)')
  g.addColorStop(0.5, 'rgba(226,196,186,0.35)')
  g.addColorStop(1, 'rgba(226,196,186,0)')
  made.ctx.fillStyle = g
  made.ctx.fillRect(0, 0, 16, 16)
  return made.canvas
}

function getAssets(hole: [number, number]): Assets | null {
  const key = hole.join(',')
  if (assets !== undefined && assetsFor === key) return assets
  assetsFor = key
  const work = canvas2d(STAGE_WIDTH * WORK_SCALE, STAGE_HEIGHT * WORK_SCALE)
  const storm = cloudTexture(21, UPSIDE_DOWN.storm, 3, -1.1)
  const churn = cloudTexture(44, [[0, 0, 0]], 2.4, -0.95)
  const mask = reachMask(hole)
  const dot = softDot()
  assets = work && storm && churn && mask && dot ? { storm, churn, mask, work: work.canvas, w: work.ctx, dot } : null
  return assets
}

/* ---------- one frame ---------- */

/** Draw `texture` stretched over the stage, scrolled `offset` px and wrapped. */
function drawWrapped(c: CanvasRenderingContext2D, texture: HTMLCanvasElement, offset: number) {
  const x = mod(offset, STAGE_WIDTH)
  c.drawImage(texture, x - STAGE_WIDTH, 0, STAGE_WIDTH, STAGE_HEIGHT)
  c.drawImage(texture, x, 0, STAGE_WIDTH, STAGE_HEIGHT)
}

/** The storm, its glow and the legs cut through them, on the half-res work canvas. */
function drawStorm(a: Assets, t: number, flash: number, [hx, hy]: [number, number], velocity: [number, number]) {
  const w = a.w
  w.setTransform(1, 0, 0, 1, 0, 0)
  w.globalCompositeOperation = 'source-over'
  w.globalAlpha = 1
  w.clearRect(0, 0, a.work.width, a.work.height)
  w.setTransform(WORK_SCALE, 0, 0, WORK_SCALE, 0, 0)

  const breath = 0.85 + 0.15 * Math.sin((t * TAU) / 9)
  const glow = w.createRadialGradient(hx, hy, 0, hx, hy, UPSIDE_DOWN.glowRadius)
  glow.addColorStop(0, `rgba(190,22,28,${Math.min(1, 0.7 * breath + 0.3 * flash)})`)
  glow.addColorStop(1, 'rgba(190,22,28,0)')
  w.fillStyle = glow
  w.fillRect(hx - UPSIDE_DOWN.glowRadius, hy - UPSIDE_DOWN.glowRadius, UPSIDE_DOWN.glowRadius * 2, UPSIDE_DOWN.glowRadius * 2)

  w.globalCompositeOperation = 'lighter'
  w.globalAlpha = breath
  drawWrapped(w, a.storm, t * UPSIDE_DOWN.drift[0])
  if (flash > 0) {
    w.globalAlpha = flash * 0.7
    drawWrapped(w, a.storm, t * UPSIDE_DOWN.drift[0])
  }

  w.globalCompositeOperation = 'destination-out'
  w.globalAlpha = 0.4
  drawWrapped(w, a.churn, t * UPSIDE_DOWN.drift[1])

  // The legs: drawn far off-canvas so only their blurred shadow lands, cutting soft holes.
  w.globalAlpha = 1
  w.save()
  w.shadowColor = 'rgba(0,0,0,0.85)'
  w.shadowBlur = 8
  w.shadowOffsetX = 5000
  w.setTransform(WORK_SCALE, 0, 0, WORK_SCALE, -5000, 0)
  w.fillStyle = '#000'
  w.beginPath()
  w.moveTo(hx, hy - 190)
  w.quadraticCurveTo(hx + 44, hy - 60, hx + 26, hy + 56)
  w.quadraticCurveTo(hx, hy + 86, hx - 26, hy + 56)
  w.quadraticCurveTo(hx - 44, hy - 60, hx, hy - 190)
  for (let i = 0; i < UPSIDE_DOWN.legs.length; i++) {
    const { ctrl: [qx, qy], tip: [tx, ty] } = legPose(i, t, [hx, hy], velocity)
    w.moveTo(hx - 26, hy - 14)
    w.quadraticCurveTo(qx, qy, tx, ty)
    w.quadraticCurveTo(qx + 40, qy + 58, hx + 26, hy + 22)
    w.closePath()
  }
  w.fill()
  w.restore()

  w.setTransform(1, 0, 0, 1, 0, 0)
  w.globalCompositeOperation = 'destination-in'
  w.drawImage(a.mask, 0, 0)
  w.globalCompositeOperation = 'source-over'
}

function drawBolt(c: CanvasRenderingContext2D, strike: Strike, hole: [number, number]) {
  const points = boltPoints(strike.strike, hole)
  const [bx, by] = points[7]
  const side = hash(strike.strike + 9) < 0.5 ? -1 : 1
  const branch: [number, number][] = [[bx, by]]
  for (let i = 1; i <= 6; i++) branch.push([bx + side * i * 9 + (hash(strike.strike * 13 + i) - 0.5) * 10, by + i * 13])
  c.save()
  c.lineJoin = 'miter'
  c.lineCap = 'butt'
  c.shadowColor = `rgba(255,90,80,${strike.intensity})`
  // [width, alpha, bloom]: a soft bloom, then a hot white core
  for (const [width, alpha, blur] of [[3.5, 0.5, 26], [1.4, 1, 6]] as const) {
    c.shadowBlur = blur
    c.lineWidth = width
    c.strokeStyle = `rgba(255,240,236,${alpha * strike.intensity})`
    for (const line of [points, branch]) {
      c.beginPath()
      c.moveTo(...line[0])
      for (const p of line.slice(1)) c.lineTo(...p)
      c.stroke()
    }
  }
  c.restore()
}

export function drawUpsideDown(c: CanvasRenderingContext2D, t: number, [cx, cy]: [number, number]) {
  const hole: [number, number] = [cx, cy]
  const heart = heartAt(t, hole)
  const before = heartAt(t - 1, hole)
  const strike = lightningAt(t)
  const flash = strike?.intensity ?? 0

  c.fillStyle = '#000'
  c.fillRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT)

  const a = getAssets(hole)
  if (a) {
    drawStorm(a, t, flash, heart, [heart[0] - before[0], heart[1] - before[1]])
    c.drawImage(a.work, 0, 0, STAGE_WIDTH, STAGE_HEIGHT)
  }

  const g = c.createRadialGradient(cx, cy, 0, cx, cy, UPSIDE_DOWN.occluder)
  g.addColorStop(0, 'rgba(0,0,0,.95)')
  g.addColorStop(0.7, 'rgba(0,0,0,.8)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  c.fillStyle = g
  c.beginPath()
  c.arc(cx, cy, UPSIDE_DOWN.occluder, 0, TAU)
  c.fill()

  if (strike) drawBolt(c, strike, hole)

  if (a) {
    for (let i = 0; i < UPSIDE_DOWN.spores; i++) {
      const s = sporeAt(i, t)
      c.globalAlpha = s.opacity
      c.drawImage(a.dot, s.x - s.radius * 3, s.y - s.radius * 3, s.radius * 6, s.radius * 6)
    }
    c.globalAlpha = 1
  }
}
