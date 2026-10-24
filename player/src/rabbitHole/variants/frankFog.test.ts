import { describe, expect, it, vi } from 'vitest'
import { FRANK_FOG, drawFrankFog, eyeOpen, frankPose } from './frankFog'

describe('eyeOpen', () => {
  it('blinks once in every window, briefly, and stays open the rest of the time', () => {
    const step = 0.01
    for (let k = 0; k < 6; k++) {
      let shut = 0
      for (let t = k * FRANK_FOG.blinkEvery; t < (k + 1) * FRANK_FOG.blinkEvery; t += step) {
        const open = eyeOpen(t)
        expect(open).toBeGreaterThanOrEqual(0)
        expect(open).toBeLessThanOrEqual(1)
        if (open < 0.5) shut += step
      }
      expect(shut).toBeGreaterThan(0.1)
      expect(shut).toBeLessThan(0.2)
    }
  })
})

describe('frankPose', () => {
  it('sways a little, never far from where the design put him', () => {
    for (let t = 0; t < 200; t += 0.5) {
      const { dx, dy, tilt } = frankPose(t)
      expect(Math.abs(dx)).toBeLessThanOrEqual(50)
      expect(Math.abs(dy)).toBeLessThanOrEqual(8)
      expect(Math.abs(tilt)).toBeLessThanOrEqual(0.03)
    }
  })
})

describe('drawFrankFog', () => {
  it('paints black, then ends on black under the event text, without a DOM canvas', () => {
    const gradient = { addColorStop: vi.fn() }
    const ctx = new Proxy({} as Record<string | symbol, unknown>, {
      get(target, key) {
        if (!(key in target)) target[key] = key === 'createRadialGradient' ? vi.fn(() => gradient) : vi.fn()
        return target[key]
      },
      set(target, key, value) { target[key] = value; return true },
    }) as unknown as CanvasRenderingContext2D & Record<string, ReturnType<typeof vi.fn>>

    drawFrankFog(ctx, 0, [300, 640])

    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 1920, 1080)
    expect(ctx.arc).toHaveBeenLastCalledWith(300, 640, FRANK_FOG.occluder, 0, Math.PI * 2)
  })
})
