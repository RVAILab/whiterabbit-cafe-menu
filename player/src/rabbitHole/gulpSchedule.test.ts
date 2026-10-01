import { describe, expect, it } from 'vitest'
import { nextScheduledGulpDelayMs } from './gulpSchedule'

const MINUTE = 60_000

describe('nextScheduledGulpDelayMs', () => {
  it('spreads intervalMinutes ± 2 minutes over random()', () => {
    expect(nextScheduledGulpDelayMs(15, () => 0)).toBe(13 * MINUTE)
    expect(nextScheduledGulpDelayMs(15, () => 0.5)).toBe(15 * MINUTE)
    expect(nextScheduledGulpDelayMs(15, () => 0.75)).toBe(16 * MINUTE)
  })

  it('never goes under the 60s minimum gap', () => {
    expect(nextScheduledGulpDelayMs(1, () => 0)).toBe(MINUTE)
    expect(nextScheduledGulpDelayMs(0.5, () => 0.5)).toBe(MINUTE)
  })
})
