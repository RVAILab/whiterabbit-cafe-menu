import { describe, expect, it } from 'vitest'
import { formatEventTime, formatRelativeEventTime } from './eventTime'

// Local-time constructors, so the expectations hold in any time zone.
const now = new Date(2026, 9, 1, 14, 30) // Thu Oct 1 2026, 2:30 PM
const iso = (y: number, mo: number, d: number, h: number, mi: number) =>
  new Date(y, mo, d, h, mi).toISOString()

describe('formatEventTime (the Upcoming card)', () => {
  it('says Today for a start later today', () => {
    expect(formatEventTime(iso(2026, 9, 1, 19, 0), now)).toEqual({ date: 'Today', time: '7:00 PM' })
  })

  it('says Tomorrow for a start tomorrow', () => {
    expect(formatEventTime(iso(2026, 9, 2, 18, 0), now)).toEqual({ date: 'Tomorrow', time: '6:00 PM' })
  })

  it('gives a short weekday and date further out', () => {
    expect(formatEventTime(iso(2026, 9, 6, 9, 5), now)).toEqual({ date: 'Tue, Oct 6', time: '9:05 AM' })
  })

  it('handles tomorrow across a month boundary', () => {
    const endOfMonth = new Date(2026, 8, 30, 22, 0)
    expect(formatEventTime(iso(2026, 9, 1, 0, 30), endOfMonth)).toEqual({ date: 'Tomorrow', time: '12:30 AM' })
  })
})

describe('formatRelativeEventTime (the event at the hole)', () => {
  it('joins the day and time with a middle dot', () => {
    expect(formatRelativeEventTime(iso(2026, 9, 2, 18, 0), now)).toBe('Tomorrow · 6:00 PM')
    expect(formatRelativeEventTime(iso(2026, 9, 1, 19, 0), now)).toBe('Today · 7:00 PM')
    expect(formatRelativeEventTime(iso(2026, 9, 6, 9, 5), now)).toBe('Tue, Oct 6 · 9:05 AM')
  })
})
