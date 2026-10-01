/** Canvas helpers shared by hole variants (ported from the reference player). */

export const TAU = Math.PI * 2

/** The ring and vortex palette: pink, lavender, gold, as `r,g,b` (SPEC §4). */
export const HOLE_PALETTE = ['255,132,198', '200,181,255', '255,211,110'] as const

/** Trace a rounded rectangle as the current path. */
export function roundRectPath(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  c.beginPath()
  c.moveTo(x + r, y)
  c.arcTo(x + w, y, x + w, y + h, r)
  c.arcTo(x + w, y + h, x, y + h, r)
  c.arcTo(x, y + h, x, y, r)
  c.arcTo(x, y, x + w, y, r)
  c.closePath()
}

/**
 * A soap bubble: white highlight upper left, pink and cyan rim (SPEC §6.1).
 * The reference's bubble, kept over the Bubbles visualization's: that one is
 * a closure-local, random-hue, desaturated body plus shine plus rim (three
 * paints), while this is one fill in the hole palette.
 */
export function drawBubble(c: CanvasRenderingContext2D, x: number, y: number, r: number, a: number) {
  if (r <= 0 || a <= 0) return
  const g = c.createRadialGradient(x - r * 0.32, y - r * 0.4, 0, x, y, r)
  g.addColorStop(0, `rgba(255,255,255,${0.95 * a})`)
  g.addColorStop(0.1, `rgba(255,230,250,${0.35 * a})`)
  g.addColorStop(0.55, `rgba(200,180,255,${0.16 * a})`)
  g.addColorStop(0.86, `rgba(150,225,255,${0.18 * a})`)
  g.addColorStop(0.98, `rgba(255,200,240,${0.45 * a})`)
  g.addColorStop(1, 'rgba(0,0,0,0)')
  c.fillStyle = g
  c.beginPath()
  c.arc(x, y, r, 0, TAU)
  c.fill()
}
