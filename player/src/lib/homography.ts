/**
 * Corner pin: the projective transform that maps the fixed 1920×1080 stage
 * onto four viewport points. Calibrated and uncalibrated rendering share this
 * one path; "uncalibrated" is just the default letterbox corners.
 */

export const STAGE_WIDTH = 1920
export const STAGE_HEIGHT = 1080

export type Point = [number, number]
/** TL, TR, BR, BL. */
export type Corners = [Point, Point, Point, Point]

// Gaussian elimination with partial pivoting; mutates its arguments.
function solve(A: number[][], b: number[]): number[] {
  const n = b.length
  for (let i = 0; i < n; i++) {
    let pivot = i
    for (let r = i + 1; r < n; r++) {
      if (Math.abs(A[r][i]) > Math.abs(A[pivot][i])) pivot = r
    }
    ;[A[i], A[pivot]] = [A[pivot], A[i]]
    ;[b[i], b[pivot]] = [b[pivot], b[i]]
    for (let r = i + 1; r < n; r++) {
      const f = A[r][i] / A[i][i]
      for (let c = i; c < n; c++) A[r][c] -= f * A[i][c]
      b[r] -= f * b[i]
    }
  }
  const x = new Array<number>(n)
  for (let i = n - 1; i >= 0; i--) {
    let s = b[i]
    for (let c = i + 1; c < n; c++) s -= A[i][c] * x[c]
    x[i] = s / A[i][i]
  }
  return x
}

/** h0..h7 (h8 = 1) of the homography taking the stage rectangle to `target`. */
export function solveHomography(target: Corners): number[] {
  const source: Corners = [[0, 0], [STAGE_WIDTH, 0], [STAGE_WIDTH, STAGE_HEIGHT], [0, STAGE_HEIGHT]]
  const A: number[][] = []
  const b: number[] = []
  source.forEach(([x, y], i) => {
    const [u, v] = target[i]
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y])
    b.push(u)
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y])
    b.push(v)
  })
  return solve(A, b)
}

/** CSS `matrix3d` for a surface with `transform-origin: 0 0`; `target` in viewport px. */
export function homographyMatrix3d(target: Corners): string {
  const h = solveHomography(target)
  return `matrix3d(${h[0]},${h[3]},0,${h[6]},${h[1]},${h[4]},0,${h[7]},0,0,1,0,${h[2]},${h[5]},0,1)`
}

/** The letterboxed 16:9 fit of the viewport, normalized to 0..1. */
export function defaultCorners(viewportWidth: number, viewportHeight: number): Corners {
  const scale = Math.min(viewportWidth / STAGE_WIDTH, viewportHeight / STAGE_HEIGHT)
  const w = STAGE_WIDTH * scale
  const h = STAGE_HEIGHT * scale
  const x = (viewportWidth - w) / 2
  const y = (viewportHeight - h) / 2
  const px: Corners = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]
  return px.map(([a, c]) => [a / viewportWidth, c / viewportHeight]) as Corners
}

/** Normalized corners to viewport px. */
export function toViewportPx(corners: Corners, viewportWidth: number, viewportHeight: number): Corners {
  return corners.map(([x, y]) => [x * viewportWidth, y * viewportHeight]) as Corners
}
