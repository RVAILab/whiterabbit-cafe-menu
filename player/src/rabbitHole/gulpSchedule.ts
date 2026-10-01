import type { RabbitHoleGulpSettings } from '../lib/displayControl'
import { GULP_MIN_GAP_MS } from './gulpController'

/** Scheduled gulps land within intervalMinutes ± this (SPEC §7.2). */
export const GULP_SCHEDULE_JITTER_MS = 2 * 60_000

export type GulpScheduleSettings = Pick<RabbitHoleGulpSettings, 'enabled' | 'intervalMinutes'>

/**
 * The schedule when display control has no v2 settings (a v1 server, or only
 * `?layout=rabbit-hole` picked the rabbit hole): the SPEC §8 default, on every
 * 15 minutes, the same way hole settings fall back to dive/0.4.
 */
export const DEFAULT_GULP_SCHEDULE: GulpScheduleSettings = { enabled: true, intervalMinutes: 15 }

/**
 * Ms until the next scheduled gulp: intervalMinutes ± 2 minutes, uniform over
 * `random()` in [0, 1) (0 → −2 min, 0.5 → exact). Never under the 60s minimum
 * gap, so a tiny interval cannot spin.
 */
export function nextScheduledGulpDelayMs(intervalMinutes: number, random: () => number = Math.random): number {
  const jitter = (random() * 2 - 1) * GULP_SCHEDULE_JITTER_MS
  return Math.max(GULP_MIN_GAP_MS, Math.round(intervalMinutes * 60_000 + jitter))
}
