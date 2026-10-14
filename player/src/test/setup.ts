import { beforeEach, vi } from 'vitest'

// Before 10am Pacific the projector shows the clubhouse notice by default, so
// every test starts at noon Pacific (still ticking) unless it sets its own time.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-10-12T19:00:00Z')) // Monday, noon PDT
})
