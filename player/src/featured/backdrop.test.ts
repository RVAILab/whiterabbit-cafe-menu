import { describe, expect, it } from 'vitest'
import { flakePose, textFade } from './backdrop'

describe('flakePose', () => {
  it('falls downward and loops from above the stage to below it', () => {
    const a = flakePose(3, 10)
    const b = flakePose(3, 11)
    expect(b.y === a.y || b.y > a.y || b.y < -100).toBe(true)
    for (let t = 0; t < 200; t += 7) {
      const { y, squash } = flakePose(5, t)
      expect(y).toBeGreaterThanOrEqual(-125)
      expect(y).toBeLessThan(1080 + 125)
      expect(squash).toBeGreaterThanOrEqual(0.6)
      expect(squash).toBeLessThanOrEqual(1)
    }
  })
})

describe('textFade', () => {
  const rect = { x: 100, y: 100, w: 200, h: 30 }
  it('hides a flake behind text, eases it back in, full strength in open space', () => {
    expect(textFade(200, 115, 20, [rect])).toBe(0)
    const near = textFade(200, 145, 20, [rect])
    expect(near).toBeGreaterThan(0)
    expect(near).toBeLessThan(1)
    expect(textFade(200, 300, 20, [rect])).toBe(1)
    expect(textFade(200, 115, 20, [])).toBe(1)
  })
})

describe('flake turning', () => {
  it('varies its turn rate over time, as if in the wind', () => {
    const rates = [0, 5, 10, 15].map((t) => flakePose(2, t + 1).angle - flakePose(2, t).angle)
    expect(Math.max(...rates) - Math.min(...rates)).toBeGreaterThan(0.05)
  })
  it('uses several snowflake designs across the snowfall', () => {
    expect(new Set(Array.from({ length: 24 }, (_, i) => flakePose(i, 0).design)).size).toBeGreaterThan(4)
  })
})
