/**
 * The café and clubhouse hours the clubhouse overlay shows. The overlay is
 * switched on by hand (POS or the 7 key); these only shape its wording.
 */
export const CAFE_HOURS = '10am–6pm · Mon–Sat'
export const CLUBHOUSE_HOURS = 'from 9am'

const CAFE_OPENS_HOUR = 10

/**
 * The headline for the clubhouse overlay at `now` (player-local time):
 * "Café opens at 10am" on a Monday–Saturday morning, when that is true,
 * otherwise "Café closed" (evenings, Sundays, or a closed café mid-day).
 */
export function cafeHeadline(now: Date): string {
  const day = now.getDay() // 0 = Sunday
  if (day !== 0 && now.getHours() < CAFE_OPENS_HOUR) return 'Café opens at 10am'
  return 'Café closed'
}
