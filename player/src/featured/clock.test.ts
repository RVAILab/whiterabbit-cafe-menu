import { describe, expect, it } from 'vitest'
import { formatClock } from './clock'

describe('formatClock', () => {
  it('shows h:mm on a 12-hour clock', () => {
    expect(formatClock(new Date(2026, 10, 26, 9, 5))).toBe('9:05')
    expect(formatClock(new Date(2026, 10, 26, 0, 0))).toBe('12:00')
    expect(formatClock(new Date(2026, 10, 26, 12, 30))).toBe('12:30')
    expect(formatClock(new Date(2026, 10, 26, 15, 45))).toBe('3:45')
  })
})
