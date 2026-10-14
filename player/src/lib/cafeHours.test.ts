import { describe, expect, it } from 'vitest'
import { beforeCafeOpens, cafeHeadline } from './cafeHours'

// Instants in Pacific time (PDT, UTC−7 in October), whatever zone runs the
// tests. Oct 12 2026 is a Monday.
const at = (date: number, hour: number, minute = 0) => new Date(Date.UTC(2026, 9, date, hour + 7, minute))

describe('cafeHeadline', () => {
  it('says the café opens at 10 on a weekday morning', () => {
    expect(cafeHeadline(at(12, 9, 0))).toBe('Café opens at 10am')
    expect(cafeHeadline(at(12, 9, 59))).toBe('Café opens at 10am')
  })

  it('says the café opens at 10 on a Saturday morning', () => {
    expect(cafeHeadline(at(17, 8, 30))).toBe('Café opens at 10am')
  })

  it('says closed on a Sunday morning', () => {
    expect(cafeHeadline(at(18, 9, 0))).toBe('Café closed')
  })

  it('says closed once 10am has passed (a closed café mid-day) and in the evening', () => {
    expect(cafeHeadline(at(12, 10, 0))).toBe('Café closed')
    expect(cafeHeadline(at(12, 14, 0))).toBe('Café closed')
    expect(cafeHeadline(at(12, 19, 30))).toBe('Café closed')
  })
})

describe('beforeCafeOpens', () => {
  it('is true from midnight until 10am Pacific, any day', () => {
    expect(beforeCafeOpens(at(12, 0, 0))).toBe(true)
    expect(beforeCafeOpens(at(12, 9, 59))).toBe(true)
    expect(beforeCafeOpens(at(18, 8, 0))).toBe(true)
  })

  it('is false from 10am Pacific on', () => {
    expect(beforeCafeOpens(at(12, 10, 0))).toBe(false)
    expect(beforeCafeOpens(at(12, 23, 59))).toBe(false)
  })

  it('reads Pacific time, not the machine zone: 9am PDT is 16:00 UTC', () => {
    expect(beforeCafeOpens(new Date('2026-10-12T16:00:00Z'))).toBe(true)
    expect(beforeCafeOpens(new Date('2026-10-12T17:00:00Z'))).toBe(false)
  })
})
