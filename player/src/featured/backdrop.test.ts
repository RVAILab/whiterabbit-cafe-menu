import { describe, expect, it } from 'vitest'
import { flakePose, textFade } from './backdrop'

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
