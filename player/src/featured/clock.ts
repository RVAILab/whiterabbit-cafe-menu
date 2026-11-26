/** The wall clock, h:mm on a 12-hour clock (no AM/PM: it's on the café wall). */
export function formatClock(date: Date): string {
  return `${date.getHours() % 12 || 12}:${String(date.getMinutes()).padStart(2, '0')}`
}

