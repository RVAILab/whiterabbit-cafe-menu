import { describe, expect, it } from 'vitest'
import { BACKDROP, flakePose, snowAmount } from './backdrop'

describe('snowAmount', () => {
  it('is glows only most of the cycle, eases into snow, holds, eases out', () => {
    expect(snowAmount(0)).toBe(0)
    expect(snowAmount(60)).toBe(0)
    expect(snowAmount(90)).toBeGreaterThan(0.3)
    expect(snowAmount(90)).toBeLessThan(0.7)
    expect(snowAmount(110)).toBe(1)
    expect(snowAmount(135)).toBeGreaterThan(0.3)
    expect(snowAmount(146)).toBe(0)
    expect(snowAmount(110 + BACKDROP.cycle)).toBe(1)
  })
})

describe('flakePose', () => {
  it('falls downward and loops from above the stage to below it', () => {
    const a = flakePose(3, 10)
    const b = flakePose(3, 11)
    expect(b.y === a.y || b.y > a.y || b.y < -100).toBe(true)
    for (let t = 0; t < 200; t += 7) {
      const { y } = flakePose(5, t)
      expect(y).toBeGreaterThanOrEqual(-120)
      expect(y).toBeLessThan(1080 + 120)
    }
  })
})
