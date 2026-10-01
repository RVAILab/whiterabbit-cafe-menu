import { describe, expect, it, vi } from 'vitest'
import { VORTEX, drawVortex, vortexBubble } from './vortex'

function recordingContext() {
  const gradient = { addColorStop: vi.fn() }
  const ctx = {
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    createRadialGradient: vi.fn(() => gradient),
    lineWidths: [] as number[],
    strokeStyles: [] as string[],
    set lineWidth(v: number) { this.lineWidths.push(v) },
    set strokeStyle(v: string) { this.strokeStyles.push(v) },
    fillStyle: '' as unknown,
    lineCap: '',
  }
  return { ctx, gradient }
}

describe('drawVortex (SPEC §6.2)', () => {
  it('strokes 7 log-spiral arms from r=14 to 1700 in ×1.035 steps, round-capped', () => {
    const { ctx } = recordingContext()
    drawVortex(ctx as unknown as CanvasRenderingContext2D, 0, [300, 520])

    let steps = 0
    for (let r = 14; r < 1700; r *= 1.035) steps++
    expect(ctx.stroke).toHaveBeenCalledTimes(7 * steps)
    expect(ctx.lineCap).toBe('round')

    // Arm 0, first segment at t=0: angle 1.7·ln(14), y squashed by .82.
    const a = 1.7 * Math.log(14)
    expect(ctx.moveTo.mock.calls[0][0]).toBeCloseTo(300 + Math.cos(a) * 14)
    expect(ctx.moveTo.mock.calls[0][1]).toBeCloseTo(520 + Math.sin(a) * 14 * 0.82)
    expect(ctx.lineWidths[0]).toBeCloseTo(1 + 14 * 0.028)
    expect(ctx.strokeStyles[0]).toBe(`rgba(255,132,198,${(14 / 260) * 0.9})`)
  })

  it('caps arm alpha at .9 and ends with a 230px black occluder', () => {
    const { ctx, gradient } = recordingContext()
    drawVortex(ctx as unknown as CanvasRenderingContext2D, 3, [300, 520])

    expect(ctx.strokeStyles.some((s) => s.endsWith(',0.9)'))).toBe(true)
    expect(ctx.arc.mock.calls.at(-1)).toEqual([300, 520, VORTEX.occluder, 0, Math.PI * 2])
    expect(gradient.addColorStop.mock.calls.slice(-3)).toEqual([
      [0, 'rgba(0,0,0,1)'],
      [0.75, 'rgba(0,0,0,.92)'],
      [1, 'rgba(0,0,0,0)'],
    ])
  })
})

describe('vortexBubble', () => {
  it('falls inward from 920px, shrinking to 6 and fading', () => {
    const start = vortexBubble(0, 0)
    expect(Math.hypot(start.dx, start.dy / VORTEX.squash)).toBeCloseTo(920)
    expect(start.radius).toBeCloseTo(46)
    expect(start.opacity).toBeCloseTo(0.8)

    const late = vortexBubble(0, VORTEX.bubblePeriod * 0.999)
    expect(Math.hypot(late.dx, late.dy / VORTEX.squash)).toBeLessThan(25)
    expect(late.radius).toBeLessThan(6.1)
    expect(late.opacity).toBeLessThan(0.01)
  })

  it('spaces the 14 bubbles evenly through their life', () => {
    const r = (i: number) => {
      const b = vortexBubble(i, 0)
      return Math.hypot(b.dx, b.dy / VORTEX.squash)
    }
    expect(r(7)).toBeCloseTo(900 * 0.5 + 20)
  })
})
