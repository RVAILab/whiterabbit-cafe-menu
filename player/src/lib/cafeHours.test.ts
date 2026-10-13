import { describe, expect, it } from 'vitest'
import { cafeHeadline } from './cafeHours'

// Local-time constructors, so the expectations hold in any time zone.
// Oct 12 2026 is a Monday.
const at = (date: number, hour: number, minute = 0) => new Date(2026, 9, date, hour, minute)

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
