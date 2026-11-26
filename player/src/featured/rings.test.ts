import { describe, expect, it } from 'vitest'
import { edgeFade } from './rings'

describe('edgeFade', () => {
  it('keeps small rings, fades as they reach the edges, gone at full size', () => {
    expect(edgeFade(0.1)).toBe(1)
    expect(edgeFade(0.3)).toBe(1)
    expect(edgeFade(0.6)).toBeGreaterThan(0.3)
    expect(edgeFade(0.6)).toBeLessThan(0.8)
    expect(edgeFade(0.95)).toBe(0)
    expect(edgeFade(1.2)).toBe(0)
  })
})
