import { describe, expect, it, vi } from 'vitest'
import { PORTAL, drawPortal, parseOutlines, perspectiveRings, portalPose } from './portal'

describe('portalPose (the kiosk hole timings)', () => {
  it('starts centered, unrotated, bands at rest and rings fully breathed in', () => {
    const pose = portalPose(0)
    expect(pose.dx).toBeCloseTo(0)
    expect(pose.dy).toBeCloseTo(0)
    expect(pose.bands).toEqual({ rotation: 0, scale: 1 })
    expect(pose.rings.rotation).toBeCloseTo(0)
    expect(pose.rings.scale).toBeCloseTo(1 + PORTAL.depthAmount)
  })

  it('turns the bands once per 75s and the rings backwards once per 48s', () => {
    expect(portalPose(PORTAL.bandsTurn / 4).bands.rotation).toBeCloseTo(Math.PI / 2)
    expect(portalPose(PORTAL.ringsTurn / 4).rings.rotation).toBeCloseTo(-Math.PI / 2)
  })

  it('breathes the bands to 1.1 halfway through the 11s cycle, out of phase with the rings', () => {
    const half = portalPose(PORTAL.depthPeriod / 2)
    expect(half.bands.scale).toBeCloseTo(1.1)
    expect(half.rings.scale).toBeCloseTo(1)
  })

  it('drifts through each keyframe and loops every 32s', () => {
    const quarter = PORTAL.driftPeriod / 4
    PORTAL.drift.forEach(([x, y], i) => {
      const pose = portalPose(i * quarter)
      expect(pose.dx).toBeCloseTo(x)
      expect(pose.dy).toBeCloseTo(y)
    })
    expect(portalPose(PORTAL.driftPeriod).dx).toBeCloseTo(0)
  })
})

describe('parseOutlines', () => {
  it('reads every path with its mean radius as a fraction of the 760 half-width', () => {
    const svg = '<svg><path d="M380 0L0 380L-380 0L0 -380Z" fill="#000"/><g><path d="M76 0L-76 0Z"/></g></svg>'
    const [outer, inner] = parseOutlines(svg)
    expect(outer.d).toBe('M380 0L0 380L-380 0L0 -380Z')
    expect(outer.radius).toBeCloseTo(0.5)
    expect(inner.radius).toBeCloseTo(0.1)
  })
})

describe('perspectiveRings', () => {
  it('spaces rings by a constant ratio, so each gap is wider than the last, out to maxRadius', () => {
    const rings = perspectiveRings([100, 200, 300, 400], PORTAL.innerRadius)
    const radii = rings.map(({ radius }) => radius * PORTAL.maxRadius)
    expect(radii[0]).toBeCloseTo(PORTAL.innerRadius)
    for (let i = 2; i < radii.length; i++) {
      expect(radii[i] - radii[i - 1]).toBeGreaterThan(radii[i - 1] - radii[i - 2])
    }
    expect(radii.at(-1)!).toBeLessThanOrEqual(PORTAL.maxRadius)
    expect(radii.at(-1)! * PORTAL.ratio).toBeGreaterThan(PORTAL.maxRadius)
  })

  it('uses each kiosk path once inside out, then cycles the outer three, scaled into place', () => {
    const sources = [400, 100, 300, 200]
    const rings = perspectiveRings(sources, PORTAL.innerRadius)
    expect(rings.slice(0, 7).map(({ source }) => source)).toEqual([1, 3, 2, 0, 3, 2, 0])
    rings.forEach(({ source, scale, radius }) =>
      expect(sources[source] * scale).toBeCloseTo(radius * PORTAL.maxRadius))
  })
})

describe('drawPortal', () => {
  it('leaves the stage black before its outlines load', () => {
    const ctx = {
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
      fillStyle: '' as unknown,
      globalCompositeOperation: '',
    }
    drawPortal(ctx as unknown as CanvasRenderingContext2D, 0, [300, 520])
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 1920, 1080)
    expect(ctx.fillStyle).toBe('#000')
    expect(ctx.globalCompositeOperation).toBe('destination-over')
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 1920, 1080)
    expect(ctx.arc).toHaveBeenCalledWith(300, 520, PORTAL.occluder, 0, Math.PI * 2)
  })
})
