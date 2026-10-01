/** Wall-clock time as the projector shows it, e.g. "7:46 PM". */
export function formatClockTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}
