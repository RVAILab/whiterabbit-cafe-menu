import { STAGE_HEIGHT, STAGE_WIDTH } from '../../lib/homography'
import { TAU } from './canvas'

/**
 * `portal`: the check-in kiosk's welcome-screen hole (whiterabbit-checkin
 * WelcomeScreen, `.k-hole`) redrawn for projection. Only outlines on black:
 * the edges of the kiosk's green bands and its thin rings, in two layers that
 * counter-rotate, breathe out of phase and drift together. The kiosk's shapes
 * are re-spaced in perspective (each ring a fixed ratio past the last, so the
 * gaps widen outward) and carried on past the menu to the far right. Outlines
 * thicken and brighten outward, then fade out toward every stage edge, so
 * nothing lights up a rectangle on the wall. Timings are the kiosk's CSS
 * durations, in seconds of phase.
 */
export const PORTAL = {
  /** Drawn size of both SVGs (viewBox 1520, centered on 0,0). */
  size: 1520,
  bandsSrc: '/images/hole-bands.svg',
  ringsSrc: '/images/hole-rings.svg',
  /** Seconds per turn; the rings turn the other way. */
  bandsTurn: 75,
  ringsTurn: 48,
  /** Breathing: scale 1 → 1.1 → 1; the rings lag half a cycle. */
  depthPeriod: 11,
  depthAmount: 0.1,
  /** Drift loop and its keyframes (stage px), eased in-out between each. */
  driftPeriod: 32,
  drift: [[0, 0], [-36, 22], [-12, -28], [26, 10]] as const,
  /**
   * Perspective spacing (stage px): ring `i` of the bands sits at
   * `innerRadius · ratio^i` out to `maxRadius`; the thin rings sit half a
   * step out, between them. `maxRadius` reaches past the stage's right edge
   * from the hole at x 300.
   */
  innerRadius: 90,
  ratio: 1.3,
  maxRadius: 2000,
  /**
   * Outline styles from the center out to `maxRadius`: width in stage px and
   * alpha ramp linearly between the two ends.
   */
  bands: { color: '150,225,85', width: [4, 40], alpha: [0.7, 1] },
  rings: { color: '228,245,200', width: [2.5, 12], alpha: [0.7, 1] },
  /** Radius of the black center occluder, as vortex: the event text sits on clean black. */
  occluder: 230,
  /** Distance over which outlines fade to black at each stage edge. */
  edgeFade: 180,
  /** The right side fades far longer, so the rings die away across the menu. */
  edgeFadeRight: 1000,
} as const

/** Sine ease-in-out, close to the kiosk's cubic-bezier(.65, 0, .35, 1). */
const easeInOut = (x: number) => 0.5 - 0.5 * Math.cos(Math.PI * x)

const frac = (x: number) => x - Math.floor(x)

const lerp = ([a, b]: readonly [number, number], x: number) => a + (b - a) * x

export interface PortalLayerPose {
  /** Radians. */
  rotation: number
  scale: number
}

export interface PortalPose {
  /** Drift offset from the hole center, stage px. */
  dx: number
  dy: number
  bands: PortalLayerPose
  rings: PortalLayerPose
}

const depth = (t: number) =>
  1 + PORTAL.depthAmount * easeInOut(1 - Math.abs(1 - 2 * frac(t / PORTAL.depthPeriod)))

/** Both layers and the drift at phase `t`. */
export function portalPose(t: number): PortalPose {
  const keys = PORTAL.drift
  const pos = frac(t / PORTAL.driftPeriod) * keys.length
  const i = Math.floor(pos)
  const [x0, y0] = keys[i]
  const [x1, y1] = keys[(i + 1) % keys.length]
  const e = easeInOut(pos - i)
  return {
    dx: x0 + (x1 - x0) * e,
    dy: y0 + (y1 - y0) * e,
    bands: { rotation: frac(t / PORTAL.bandsTurn) * TAU, scale: depth(t) },
    rings: { rotation: -frac(t / PORTAL.ringsTurn) * TAU, scale: depth(t + PORTAL.depthPeriod / 2) },
  }
}

export interface PortalOutline {
  path: Path2D
  /** Scale that puts this kiosk path at `radius`. */
  scale: number
  /** Where it is drawn, as a fraction of `maxRadius` (sets width and alpha). */
  radius: number
}

/**
 * Perspective placement for one layer: target radii `first · ratio^i` up to
 * `maxRadius`, each taking a kiosk path (inner to outer, then cycling the
 * outer three) and the scale that moves it there. `sourceRadii` are the
 * paths' own mean radii in stage px.
 */
export function perspectiveRings(sourceRadii: number[], first: number): { source: number; scale: number; radius: number }[] {
  const order = sourceRadii.map((r, i) => [r, i] as const).sort((a, b) => a[0] - b[0]).map(([, i]) => i)
  if (!order.length) return []
  const placed = []
  for (let i = 0, r = first; r <= PORTAL.maxRadius; i++, r *= PORTAL.ratio) {
    const outer = Math.min(3, order.length)
    const source = i < order.length ? order[i] : order[order.length - outer + ((i - order.length) % outer)]
    placed.push({ source, scale: r / sourceRadii[source], radius: r / PORTAL.maxRadius })
  }
  return placed
}

/** Every `<path d>` in an SVG, with its mean radius from the center. */
export function parseOutlines(svg: string): { d: string; radius: number }[] {
  return [...svg.matchAll(/\sd="([^"]+)"/g)].map(([, d]) => {
    const radii = [...d.matchAll(/(-?[\d.]+)[ ,](-?[\d.]+)/g)].map(([, x, y]) => Math.hypot(+x, +y))
    const mean = radii.reduce((sum, r) => sum + r, 0) / Math.max(radii.length, 1)
    return { d, radius: mean / (PORTAL.size / 2) }
  })
}

/** Each layer's outlines, loaded once from the kiosk SVGs. Empty until then (or without a DOM). */
const outlines: { bands: PortalOutline[]; rings: PortalOutline[] } = { bands: [], rings: [] }
let outlinesRequested = false

function requestOutlines() {
  if (outlinesRequested || typeof Path2D === 'undefined' || typeof fetch !== 'function') return
  outlinesRequested = true
  const load = (src: string, layer: keyof typeof outlines, first: number) =>
    fetch(src)
      .then(res => (res.ok ? res.text() : ''))
      .then(svg => {
        const sources = parseOutlines(svg)
        const paths = sources.map(({ d }) => new Path2D(d))
        outlines[layer] = perspectiveRings(sources.map(({ radius }) => radius * PORTAL.size / 2), first)
          .map(({ source, scale, radius }) => ({ path: paths[source], scale, radius }))
      })
      .catch(() => {})
  void load(PORTAL.bandsSrc, 'bands', PORTAL.innerRadius)
  void load(PORTAL.ringsSrc, 'rings', PORTAL.innerRadius * Math.sqrt(PORTAL.ratio))
}

let edgeMask: HTMLCanvasElement | null | undefined

/** Opaque in the middle, transparent at every stage edge; applied as `destination-in`. */
function getEdgeMask(): HTMLCanvasElement | null {
  if (edgeMask !== undefined) return edgeMask
  edgeMask = null
  if (typeof document === 'undefined') return edgeMask
  const mask = document.createElement('canvas')
  mask.width = STAGE_WIDTH
  mask.height = STAGE_HEIGHT
  const m = mask.getContext('2d')
  if (!m) return edgeMask
  const across = (length: number, horizontal: boolean, fadeEnd: number) => {
    const g = horizontal ? m.createLinearGradient(0, 0, length, 0) : m.createLinearGradient(0, 0, 0, length)
    g.addColorStop(0, 'rgba(0,0,0,0)')
    g.addColorStop(PORTAL.edgeFade / length, '#000')
    g.addColorStop(1 - fadeEnd / length, '#000')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    return g
  }
  m.fillStyle = across(STAGE_WIDTH, true, PORTAL.edgeFadeRight)
  m.fillRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT)
  m.globalCompositeOperation = 'destination-in'
  m.fillStyle = across(STAGE_HEIGHT, false, PORTAL.edgeFade)
  m.fillRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT)
  edgeMask = mask
  return edgeMask
}

type OutlineStyle = (typeof PORTAL)['bands' | 'rings']

function strokeLayer(
  c: CanvasRenderingContext2D,
  layer: PortalOutline[],
  style: OutlineStyle,
  x: number,
  y: number,
  pose: PortalLayerPose,
) {
  if (!layer.length) return
  c.save()
  c.translate(x, y)
  c.rotate(pose.rotation)
  c.scale(pose.scale, pose.scale)
  c.lineJoin = 'round'
  for (const { path, scale, radius } of layer) {
    const r = Math.min(radius, 1)
    c.save()
    c.scale(scale, scale)
    // Divided by both scales so widths stay in stage px.
    c.lineWidth = lerp(style.width, r) / (pose.scale * scale)
    c.strokeStyle = `rgba(${style.color},${lerp(style.alpha, r)})`
    c.stroke(path)
    c.restore()
  }
  c.restore()
}

export function drawPortal(c: CanvasRenderingContext2D, t: number, [cx, cy]: [number, number]) {
  requestOutlines()
  c.clearRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT)

  const pose = portalPose(t)
  strokeLayer(c, outlines.bands, PORTAL.bands, cx + pose.dx, cy + pose.dy, pose.bands)
  strokeLayer(c, outlines.rings, PORTAL.rings, cx + pose.dx, cy + pose.dy, pose.rings)

  const g = c.createRadialGradient(cx, cy, 0, cx, cy, PORTAL.occluder)
  g.addColorStop(0, 'rgba(0,0,0,1)')
  g.addColorStop(0.75, 'rgba(0,0,0,.92)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  c.fillStyle = g
  c.beginPath()
  c.arc(cx, cy, PORTAL.occluder, 0, TAU)
  c.fill()

  c.save()
  const mask = getEdgeMask()
  if (mask) {
    c.globalCompositeOperation = 'destination-in'
    c.drawImage(mask, 0, 0)
  }
  c.globalCompositeOperation = 'destination-over'
  c.fillStyle = '#000'
  c.fillRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT)
  c.restore()
}
