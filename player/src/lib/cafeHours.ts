/**
 * The café and clubhouse hours the clubhouse overlay shows. Staff switch the
 * overlay on by hand (POS or the 7 key); before the café opens it is also the
 * projector's default (`beforeCafeOpens`). Times are the café's, Pacific,
 * whatever zone the player's machine is set to.
 */
export const CAFE_HOURS = '10am–6pm · Mon–Sat'
export const CLUBHOUSE_HOURS = 'from 9am'

const CAFE_OPENS_HOUR = 10
const CAFE_TIME_ZONE = 'America/Los_Angeles'

const cafeClockFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: CAFE_TIME_ZONE,
  weekday: 'short',
  hour: 'numeric',
  hourCycle: 'h23',
})

/** The café's weekday (0 = Sunday) and hour (0–23) at `now`. */
function cafeClock(now: Date): { day: number; hour: number } {
  const parts = cafeClockFormat.formatToParts(now)
  const weekday = parts.find((part) => part.type === 'weekday')?.value
  const hour = Number(parts.find((part) => part.type === 'hour')?.value)
  return { day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday ?? ''), hour }
}

/** True before 10am Pacific, any day: the projector shows the clubhouse notice unless staff chose an overlay. */
export function beforeCafeOpens(now: Date): boolean {
  return cafeClock(now).hour < CAFE_OPENS_HOUR
}

/**
 * The headline for the clubhouse overlay at `now`: "Café opens at 10am" on a
 * Monday–Saturday morning, when that is true, otherwise "Café closed"
 * (evenings, Sundays, or a closed café mid-day).
 */
export function cafeHeadline(now: Date): string {
  const { day, hour } = cafeClock(now)
  if (day !== 0 && hour < CAFE_OPENS_HOUR) return 'Café opens at 10am'
  return 'Café closed'
}
