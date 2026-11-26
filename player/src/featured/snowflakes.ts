/**
 * Nordic snowflake designs: each draws one arm along +x in unit space (the arm
 * reaches 1), and `strokeSnowflake` repeats it six times round the center,
 * plus the design's center ornament. Lines are stroked, dots and tips filled.
 */
type Pen = {
  line(x1: number, y1: number, x2: number, y2: number): void
  /** Both sides of the arm: a line from (x, 0) out at ±deg, length `len`. */
  branch(x: number, len: number, deg: number): void
  dot(x: number, y: number, r: number): void
  /** A filled diamond along the arm from x0 to x1, half-width w. */
  diamond(x0: number, x1: number, w: number): void
  /** The same, outlined. */
  diamondOutline(x0: number, x1: number, w: number): void
  leaf(cx: number, rx: number, ry: number): void
}

interface Design {
  /** Line width as a fraction of the flake's radius. */
  weight: number
  arm(p: Pen): void
  center?(c: CanvasRenderingContext2D): void
}

const hexagon = (c: CanvasRenderingContext2D, r: number, fill: boolean) => {
  c.beginPath()
  for (let k = 0; k < 6; k++) {
    const a = (k * Math.PI) / 3 + Math.PI / 6
    if (k === 0) c.moveTo(Math.cos(a) * r, Math.sin(a) * r)
    else c.lineTo(Math.cos(a) * r, Math.sin(a) * r)
  }
  c.closePath()
  if (fill) c.fill()
  else c.stroke()
}
const ring = (c: CanvasRenderingContext2D, r: number) => {
  c.beginPath()
  c.arc(0, 0, r, 0, Math.PI * 2)
  c.stroke()
}

export const SNOWFLAKE_DESIGNS: readonly Design[] = [
  // Hexagon core, arms ending in a Y.
  { weight: 0.09, arm: (p) => { p.line(0.33, 0, 1, 0); p.branch(0.76, 0.24, 45) }, center: (c) => hexagon(c, 0.38, false) },
  // Ball tips, two pairs of branches.
  { weight: 0.07, arm: (p) => { p.line(0, 0, 0.84, 0); p.dot(0.93, 0, 0.09); p.branch(0.38, 0.22, 60); p.branch(0.6, 0.18, 60) }, center: (c) => hexagon(c, 0.14, true) },
  // Diamond tips, one pair of branches.
  { weight: 0.07, arm: (p) => { p.line(0, 0, 0.76, 0); p.diamond(0.74, 1.02, 0.09); p.branch(0.48, 0.26, 50) } },
  // Fern: three pairs of branches, shorter toward the tip.
  { weight: 0.055, arm: (p) => { p.line(0, 0, 1, 0); p.branch(0.3, 0.28, 55); p.branch(0.52, 0.22, 55); p.branch(0.72, 0.14, 55) } },
  // An open diamond mid-arm, ring at the center.
  { weight: 0.06, arm: (p) => { p.line(0.14, 0, 0.36, 0); p.diamondOutline(0.36, 0.76, 0.13); p.line(0.76, 0, 1, 0); p.branch(0.88, 0.1, 50) }, center: (c) => ring(c, 0.14) },
  // Chevrons, a dot at the tip and between the arms.
  { weight: 0.065, arm: (p) => {
    p.line(0, 0, 0.86, 0)
    for (const b of [0.46, 0.66]) { p.line(b - 0.12, 0.15, b, 0); p.line(b - 0.12, -0.15, b, 0) }
    p.dot(1, 0, 0.07)
    p.dot(Math.cos(Math.PI / 6) * 0.74, Math.sin(Math.PI / 6) * 0.74, 0.055)
  } },
  // Leaf tips round a ring.
  { weight: 0.06, arm: (p) => { p.line(0.17, 0, 0.62, 0); p.leaf(0.8, 0.18, 0.075); p.branch(0.42, 0.2, 50) }, center: (c) => ring(c, 0.17) },
  // Chunky: solid hexagon center, one long pair of branches.
  { weight: 0.1, arm: (p) => { p.line(0.2, 0, 1, 0); p.branch(0.6, 0.3, 60) }, center: (c) => hexagon(c, 0.26, true) },
]

/** Draw design `d` at radius `size` on a context already placed at the flake's center. */
export function strokeSnowflake(c: CanvasRenderingContext2D, d: number, size: number) {
  const design = SNOWFLAKE_DESIGNS[d % SNOWFLAKE_DESIGNS.length]
  c.save()
  c.scale(size, size)
  // At least ~2.6 stage px, so small flakes still read on the projector.
  c.lineWidth = Math.max(design.weight, 2.6 / size)
  c.lineCap = 'round'
  c.lineJoin = 'round'
  const pen: Pen = {
    line(x1, y1, x2, y2) { c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke() },
    branch(x, len, deg) {
      const a = (deg * Math.PI) / 180
      for (const s of [-1, 1]) pen.line(x, 0, x + Math.cos(a) * len, s * Math.sin(a) * len)
    },
    dot(x, y, r) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill() },
    diamond(x0, x1, w) {
      c.beginPath(); c.moveTo(x0, 0); c.lineTo((x0 + x1) / 2, w); c.lineTo(x1, 0); c.lineTo((x0 + x1) / 2, -w); c.closePath(); c.fill()
    },
    diamondOutline(x0, x1, w) {
      c.beginPath(); c.moveTo(x0, 0); c.lineTo((x0 + x1) / 2, w); c.lineTo(x1, 0); c.lineTo((x0 + x1) / 2, -w); c.closePath(); c.stroke()
    },
    leaf(cx, rx, ry) { c.beginPath(); c.ellipse(cx, 0, rx, ry, 0, 0, Math.PI * 2); c.fill() },
  }
  for (let k = 0; k < 6; k++) {
    c.save()
    c.rotate((k * Math.PI) / 3)
    design.arm(pen)
    c.restore()
  }
  design.center?.(c)
  c.restore()
}
