import { describe, expect, it, vi } from 'vitest'
import { UPSIDE_DOWN, boltPoints, drawUpsideDown, heartAt, legPose, lightningAt, sporeAt, stormNoise } from './upsideDown'
import { STAGE_WIDTH } from '../../lib/homography'

describe('stormNoise', () => {
  it('stays in [0, 1] and wraps horizontally, so the drifting storm has no seam', () => {
    for (const [x, y] of [[0, 0], [17.3, 200], [333, 359], [639, 12]]) {
      const n = stormNoise(x, y, 21)
      expect(n).toBeGreaterThanOrEqual(0)
      expect(n).toBeLessThanOrEqual(1)
    }
    expect(stormNoise(UPSIDE_DOWN.tex[0], 123, 21)).toBeCloseTo(stormNoise(0, 123, 21))
    expect(stormNoise(UPSIDE_DOWN.tex[0] + 41.5, 7, 21)).toBeCloseTo(stormNoise(41.5, 7, 21))
  })
})

describe('lightningAt', () => {
  it('strikes once in every window, briefly, and is dark the rest of the time', () => {
    const step = 0.01
    for (let k = 0; k < 6; k++) {
      let lit = 0
      for (let t = k * UPSIDE_DOWN.lightningEvery; t < (k + 1) * UPSIDE_DOWN.lightningEvery; t += step) {
        const s = lightningAt(t)
        if (!s) continue
        lit += step
        expect(s.strike).toBe(k)
        expect(s.intensity).toBeGreaterThanOrEqual(0)
        expect(s.intensity).toBeLessThanOrEqual(1)
      }
      expect(lit).toBeGreaterThan(0.4)
      expect(lit).toBeLessThan(0.6)
    }
  })
})

describe('boltPoints', () => {
  it('runs from near the stage top to above the event text, never into it', () => {
    const points = boltPoints(3, [300, 520])
    expect(points[0][1]).toBe(90)
    expect(points.at(-1)![1]).toBe(380)
    for (const [x] of points) expect(Math.abs(x - 300)).toBeLessThan(260)
  })
})

describe('sporeAt', () => {
  it('drifts upward and stays on the stage', () => {
    for (let i = 0; i < UPSIDE_DOWN.spores; i += 7) {
      for (const t of [0, 13.7, 999]) {
        const s = sporeAt(i, t)
        expect(s.x).toBeGreaterThanOrEqual(0)
        expect(s.x).toBeLessThan(1920)
        expect(s.y).toBeGreaterThanOrEqual(-20)
        expect(s.y).toBeLessThan(1080 + 20)
      }
    }
    expect(sporeAt(5, 1).y).toBeLessThan(sporeAt(5, 0).y)
  })
})

describe('heartAt', () => {
  const hole: [number, number] = [300, 520]

  it('starts where the heart always was, then roams across the storm and back', () => {
    expect(heartAt(0, hole)).toEqual([300 + UPSIDE_DOWN.heart[0], 520 + UPSIDE_DOWN.heart[1]])
    const xs = Array.from({ length: 400 }, (_, i) => heartAt(i, hole)[0])
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(600)
  })

  it('stays inside the faded stage edges and above the black under the event', () => {
    for (let t = 0; t < 2000; t += 0.5) {
      const [x, y] = heartAt(t, hole)
      expect(x).toBeGreaterThanOrEqual(UPSIDE_DOWN.edgeFade)
      expect(x).toBeLessThanOrEqual(STAGE_WIDTH - UPSIDE_DOWN.edgeFade)
      expect(y).toBeGreaterThanOrEqual(UPSIDE_DOWN.edgeFade - 40)
      expect(y).toBeLessThan(520 - UPSIDE_DOWN.occluder)
    }
  })

  it('moves slowly: no more than a few dozen px per second of phase', () => {
    for (let t = 1; t < 200; t++) {
      const [x0, y0] = heartAt(t - 1, hole), [x1, y1] = heartAt(t, hole)
      expect(Math.hypot(x1 - x0, y1 - y0)).toBeLessThan(60)
    }
  })
})

describe('legPose', () => {
  it('trails the legs behind the way the heart is moving', () => {
    const still = legPose(0, 5, [0, 0])
    const movingRight = legPose(0, 5, [0, 0], [30, 0])
    expect(movingRight.tip[0]).toBeLessThan(still.tip[0])
    expect(movingRight.ctrl[0]).toBeLessThan(still.ctrl[0])
  })

  it('sways each leg around its rest pose, a few dozen px at most', () => {
    UPSIDE_DOWN.legs.forEach(([, [tdx, tdy]], i) => {
      for (const t of [0, 5, 40]) {
        const { tip: [x, y] } = legPose(i, t, [0, 0])
        expect(Math.hypot(x - tdx, y - tdy)).toBeLessThan(110)
      }
    })
  })
})

describe('drawUpsideDown', () => {
  it('paints black, then ends on black under the event text, without a DOM canvas', () => {
    const gradient = { addColorStop: vi.fn() }
    const ctx = new Proxy({} as Record<string | symbol, unknown>, {
      get(target, key) {
        if (!(key in target)) target[key] = key === 'createRadialGradient' ? vi.fn(() => gradient) : vi.fn()
        return target[key]
      },
      set(target, key, value) { target[key] = value; return true },
    }) as unknown as CanvasRenderingContext2D & Record<string, ReturnType<typeof vi.fn>>

    drawUpsideDown(ctx, 0, [300, 520])

    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 1920, 1080)
    expect(ctx.arc).toHaveBeenLastCalledWith(300, 520, UPSIDE_DOWN.occluder, 0, Math.PI * 2)
  })
})
