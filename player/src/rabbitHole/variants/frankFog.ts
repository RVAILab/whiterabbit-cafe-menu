import { STAGE_HEIGHT, STAGE_WIDTH } from '../../lib/homography'
import { TAU } from './canvas'
import { stormNoise } from './upsideDown'

/**
 * `frank-fog` (Halloween): pale fog rolls across the wall and Frank's head
 * looms in it above the event, swaying, his eyes glowing and now and then
 * blinking. The look is the "Frank in the fog" board of the Halloween hole
 * canvas (claude.ai/artifact/K1uQXktNSauszBUuPuPQE9).
 *
 * A projector only adds light, so Frank is a soft hole cut in the fog: on a
 * lit wall he reads as bare wall. Fog, glow and head compose at half
 * resolution and fade out before every stage edge, as the Upside Down does.
 * The head's paths are the design's, drawn in its coordinates, where the
 * hole sits at (300, 640).
 */
export const FRANK_FOG = {
  /** Fog texture size; drawn ×2 across the stage and wrapping horizontally. */
  tex: [960, 540] as [number, number],
  fog: [158, 189, 219] as [number, number, number],
  haze: [140, 168, 199] as [number, number, number],
  /** Stage px per second of phase: the fog rolls right, the haze left. */
  drift: [10, -6] as [number, number],
  /** The design's hole, which its head paths are drawn around. */
  designHole: [300, 640] as [number, number],
  /** The head's pivot (its chin), from the hole. */
  chin: [0, -184] as [number, number],
  /** Where the eyes sit, from the chin, and how far apart. */
  eyes: { up: 113, apart: 48 },
  glowRadius: 330,
  /** The fog's reach from above the hole. */
  reach: 1200,
  occluder: 200,
  edgeFade: 180,
  /** One blink somewhere in each window of this many seconds. */
  blinkEvery: 7,
}

/** The design's head: skull, then the two prongs rising from it. */
const HEAD_PATHS = [
  'M284 198Q300 199 316 198Q331 197 346 201Q362 205 371 218Q381 230 386 247Q391 264 394 282Q397 300 397 316Q397 332 392 349Q388 367 381 384Q374 401 366 416Q358 430 346 440Q335 451 317 456Q300 462 283 456Q265 451 254 440Q242 430 234 416Q226 401 219 384Q212 367 208 349Q203 332 203 316Q203 300 206 282Q209 264 214 247Q219 230 229 218Q238 205 254 201Q269 197 284 198Z',
  'M252 219Q273 212 262 181Q251 151 241 120Q231 89 219 61Q208 32 196 12Q185 -8 177 -14Q169 -20 162 -15Q156 -11 158 -3Q161 5 168 26Q175 46 185 74Q195 101 204 132Q212 163 221 195Q230 226 252 219Z',
  'M348 217Q370 225 379 198Q388 171 398 147Q408 123 417 106Q427 90 438 81Q450 72 457 70Q465 69 471 74Q478 80 481 78Q484 75 478 65Q472 54 457 50Q442 46 422 56Q402 65 388 85Q374 105 362 130Q351 155 339 182Q327 208 348 217Z',
]

const frac = (x: number) => x - Math.floor(x)
const mod = (a: number, b: number) => ((a % b) + b) % b
const hash = (n: number) => frac(Math.sin(n * 127.1) * 43758.5453)
const clamp01 = (x: number) => Math.max(0, Math.min(1, x))

/** Frank's sway at phase `t`: a slow lumber side to side, a nod, and a breath. */
export function frankPose(t: number) {
  return {
    dx: 50 * Math.sin((t * TAU) / 31),
    dy: 8 * Math.sin((t * TAU) / 7),
    tilt: 0.03 * Math.sin((t * TAU) / 13 + 1),
  }
}

/** How open the eyes are at phase `t`: 1, closing to 0 for a blink once per window. */
export function eyeOpen(t: number): number {
  const k = Math.floor(t / FRANK_FOG.blinkEvery)
  const s = t - (k * FRANK_FOG.blinkEvery + 1 + hash(k + 3) * 4)
  if (s < 0 || s > 0.3) return 1
  return Math.abs(s - 0.15) / 0.15
}

/* ---------- rendered once ---------- */

interface Assets {
  fog: HTMLCanvasElement
  haze: HTMLCanvasElement
  mask: HTMLCanvasElement
  work: HTMLCanvasElement
  w: CanvasRenderingContext2D
  head: Path2D
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

/** A fog texture: noise to alpha (`gain·n + bias`), one flat colour. */
function fogTexture(seed: number, [r, g, b]: [number, number, number], gain: number, bias: number) {
  const [w, h] = FRANK_FOG.tex
  const made = canvas2d(w, h)
  if (!made) return null
  const img = made.ctx.createImageData(w, h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      img.data[i] = r
      img.data[i + 1] = g
      img.data[i + 2] = b
      img.data[i + 3] = 255 * clamp01(gain * stormNoise(x, y, seed) + bias)
    }
  }
  made.ctx.putImageData(img, 0, 0)
  return made.canvas
}

/** Opaque where the fog may show, fading toward its reach and to nothing at every stage edge. */
function reachMask([cx, cy]: [number, number]) {
  const made = canvas2d(STAGE_WIDTH * WORK_SCALE, STAGE_HEIGHT * WORK_SCALE)
  if (!made) return null
  const m = made.ctx
  m.scale(WORK_SCALE, WORK_SCALE)
  const g = m.createRadialGradient(cx, cy - 340, 0, cx, cy - 340, FRANK_FOG.reach)
  g.addColorStop(0, '#000')
  g.addColorStop(0.35, 'rgba(0,0,0,.7)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  m.fillStyle = g
  m.fillRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT)
  const fade = FRANK_FOG.edgeFade
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

function getAssets(hole: [number, number]): Assets | null {
  const key = hole.join(',')
  if (assets !== undefined && assetsFor === key) return assets
  assetsFor = key
  const work = canvas2d(STAGE_WIDTH * WORK_SCALE, STAGE_HEIGHT * WORK_SCALE)
  const fog = fogTexture(27, FRANK_FOG.fog, 2.4, -0.95)
  const haze = fogTexture(8, FRANK_FOG.haze, 2, -0.85)
  const mask = reachMask(hole)
  const head = typeof Path2D === 'undefined' ? null : new Path2D(HEAD_PATHS.join(' '))
  assets = work && fog && haze && mask && head ? { fog, haze, mask, work: work.canvas, w: work.ctx, head } : null
  return assets
}

/* ---------- one frame ---------- */

/** Draw `texture` stretched over the stage, scrolled `offset` px and wrapped. */
function drawWrapped(c: CanvasRenderingContext2D, texture: HTMLCanvasElement, offset: number) {
  const x = mod(offset, STAGE_WIDTH)
  c.drawImage(texture, x - STAGE_WIDTH, 0, STAGE_WIDTH, STAGE_HEIGHT)
  c.drawImage(texture, x, 0, STAGE_WIDTH, STAGE_HEIGHT)
}

/** Stage px → the design's head coordinates, swayed about the chin. */
function headTransform(c: CanvasRenderingContext2D, [cx, cy]: [number, number], t: number) {
  const { dx, dy, tilt } = frankPose(t)
  const [hx, hy] = FRANK_FOG.designHole
  const chinX = cx + FRANK_FOG.chin[0] + dx, chinY = cy + FRANK_FOG.chin[1] + dy
  c.translate(chinX, chinY)
  c.rotate(tilt)
  c.translate(-(hx + FRANK_FOG.chin[0]), -(hy + FRANK_FOG.chin[1]))
}

function drawFog(a: Assets, t: number, hole: [number, number]) {
  const [cx, cy] = hole
  const { dx } = frankPose(t)
  const w = a.w
  w.setTransform(1, 0, 0, 1, 0, 0)
  w.globalCompositeOperation = 'source-over'
  w.globalAlpha = 1
  w.clearRect(0, 0, a.work.width, a.work.height)
  w.setTransform(WORK_SCALE, 0, 0, WORK_SCALE, 0, 0)

  // The pale glow Frank stands in front of; it breathes.
  const gx = cx + dx, gy = cy - 350
  const breath = 0.85 + 0.15 * Math.sin((t * TAU) / 9)
  const glow = w.createRadialGradient(gx, gy, 0, gx, gy, FRANK_FOG.glowRadius)
  glow.addColorStop(0, `rgba(169,196,220,${0.55 * breath})`)
  glow.addColorStop(1, 'rgba(169,196,220,0)')
  w.fillStyle = glow
  w.fillRect(gx - FRANK_FOG.glowRadius, gy - FRANK_FOG.glowRadius, FRANK_FOG.glowRadius * 2, FRANK_FOG.glowRadius * 2)

  drawWrapped(w, a.fog, t * FRANK_FOG.drift[0])

  // Frank: drawn far off-canvas so only his blurred shadow lands, cutting a soft hole.
  w.save()
  w.globalCompositeOperation = 'destination-out'
  w.shadowColor = 'rgba(0,0,0,0.92)'
  w.shadowBlur = 6
  w.shadowOffsetX = 5000
  w.setTransform(WORK_SCALE, 0, 0, WORK_SCALE, -5000, 0)
  headTransform(w, hole, t)
  w.fillStyle = '#000'
  w.fill(a.head)
  w.restore()

  w.globalAlpha = 0.35
  drawWrapped(w, a.haze, t * FRANK_FOG.drift[1])
  w.globalAlpha = 1

  w.setTransform(1, 0, 0, 1, 0, 0)
  w.globalCompositeOperation = 'destination-in'
  w.drawImage(a.mask, 0, 0)
  w.globalCompositeOperation = 'source-over'
}

/** Two pale eyes, each a soft glow round a bright core, squeezed shut by `open`. */
function drawEyes(c: CanvasRenderingContext2D, hole: [number, number], t: number) {
  const open = eyeOpen(t)
  if (open <= 0.02) return
  const [hx, hy] = FRANK_FOG.designHole
  const eyeY = hy + FRANK_FOG.chin[1] - FRANK_FOG.eyes.up
  c.save()
  headTransform(c, hole, t)
  for (const side of [-1, 1]) {
    c.save()
    c.translate(hx + side * FRANK_FOG.eyes.apart, eyeY)
    c.rotate(-side * 0.14)
    c.scale(1, open * 0.6)
    for (const [r, alpha] of [[34, 0.45], [16, 0.85]] as const) {
      const g = c.createRadialGradient(0, 0, 0, 0, 0, r)
      g.addColorStop(0, `rgba(238,247,255,${alpha})`)
      g.addColorStop(0.5, `rgba(207,230,255,${alpha * 0.6})`)
      g.addColorStop(1, 'rgba(207,230,255,0)')
      c.fillStyle = g
      c.beginPath()
      c.arc(0, 0, r, 0, TAU)
      c.fill()
    }
    c.restore()
  }
  c.restore()
}

export function drawFrankFog(c: CanvasRenderingContext2D, t: number, [cx, cy]: [number, number]) {
  const hole: [number, number] = [cx, cy]
  c.fillStyle = '#000'
  c.fillRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT)

  const a = getAssets(hole)
  if (a) {
    drawFog(a, t, hole)
    c.drawImage(a.work, 0, 0, STAGE_WIDTH, STAGE_HEIGHT)
  }

  const g = c.createRadialGradient(cx, cy, 0, cx, cy, FRANK_FOG.occluder)
  g.addColorStop(0, 'rgba(0,0,0,.95)')
  g.addColorStop(0.7, 'rgba(0,0,0,.8)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  c.fillStyle = g
  c.beginPath()
  c.arc(cx, cy, FRANK_FOG.occluder, 0, TAU)
  c.fill()

  if (a) drawEyes(c, hole, t)
}
