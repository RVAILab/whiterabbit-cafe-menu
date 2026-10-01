import { describe, expect, it, vi } from 'vitest'
import { resolveHoleSettings } from '../lib/holeSettings'
import { stepPhase } from './holeLoop'
import { diveBubble, diveRingOpacity, diveRings } from './variants/dive'

describe('dive rings (SPEC §6.1)', () => {
  it('fades in to .9 by 12% of life, eases to .8 by 88%, then out to 0', () => {
    expect(diveRingOpacity(0)).toBe(0)
    expect(diveRingOpacity(0.06)).toBeCloseTo(0.45)
    expect(diveRingOpacity(0.12)).toBeCloseTo(0.9)
    expect(diveRingOpacity(0.5)).toBeCloseTo(0.85)
    expect(diveRingOpacity(0.88)).toBeCloseTo(0.8)
    expect(diveRingOpacity(0.94)).toBeCloseTo(0.4)
  })

  it('places ten rings in depth and projects them with perspective 620', () => {
    const rings = diveRings(0)
    expect(rings).toHaveLength(10)
    const farthest = rings[0]
    expect(farthest).toMatchObject({ k: 0, life: 0, z: -6000 })
    expect(farthest.scale).toBeCloseTo(620 / 6620)
    const nearest = rings[9]
    expect(nearest.k).toBe(9)
    expect(nearest.z).toBeCloseTo(-492)
    expect(nearest.scale).toBeCloseTo(620 / 1112)
  })

  it('draws far to near as the rings travel over the 20s period', () => {
    const rings = diveRings(19) // ring 0 is at 95% of its life
    expect(rings.map((r) => r.z)).toEqual([...rings.map((r) => r.z)].sort((a, b) => a - b))
    expect(rings[9].k).toBe(0)
    expect(rings[9].z).toBeCloseTo(-186)
  })
})

describe('dive bubbles', () => {
  it('start as a speck at the hole, invisible', () => {
    const b = diveBubble(0, 0)
    expect(Math.hypot(b.dx, b.dy)).toBe(0)
    expect(b.radius).toBeCloseTo(2.75)
    expect(b.opacity).toBe(0)
  })
})

describe('stepPhase', () => {
  it('eases speedMul toward the target by dt*3 and advances by dt*speed*speedMul', () => {
    const next = stepPhase({ phase: 0, speedMul: 1 }, 0.05, 0.4, 5)
    expect(next.speedMul).toBeCloseTo(1.6)
    expect(next.phase).toBeCloseTo(0.032)
  })

  it('caps a stalled frame at 0.1s', () => {
    const next = stepPhase({ phase: 2, speedMul: 1 }, 4, 0.4, 1)
    expect(next.phase).toBeCloseTo(2.04)
  })
})

describe('resolveHoleSettings', () => {
  it('defaults to dive at 0.4', () => {
    expect(resolveHoleSettings({ search: '' })).toEqual({ variant: 'dive', speed: 0.4 })
  })

  it('takes ?speed= over display control, clamped to 0.05..5 (display control: 0.2..1)', () => {
    expect(resolveHoleSettings({ search: '?speed=0.7', desired: { speed: 0.3 } }).speed).toBe(0.7)
    expect(resolveHoleSettings({ search: '', desired: { speed: 0.3 } }).speed).toBe(0.3)
    expect(resolveHoleSettings({ search: '?speed=5' }).speed).toBe(5)
    expect(resolveHoleSettings({ search: '?speed=9' }).speed).toBe(5)
    expect(resolveHoleSettings({ search: '?speed=0.01' }).speed).toBe(0.05)
    expect(resolveHoleSettings({ search: '', desired: { speed: 3 } }).speed).toBe(1)
    expect(resolveHoleSettings({ search: '?speed=fast' }).speed).toBe(0.4)
  })

  it('falls back to dive for an unknown variant, with a warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(resolveHoleSettings({ search: '?variant=burrow' }).variant).toBe('dive')
    expect(warn).toHaveBeenCalledOnce()
    warn.mockRestore()
  })
})
