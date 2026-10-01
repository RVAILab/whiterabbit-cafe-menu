function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
  )
}

/**
 * When an event starts, relative to `now`: "Today" / "Tomorrow" / "Tue, Oct 6",
 * and "6:00 PM". Shared by the Upcoming card and the event at the hole.
 */
export function formatEventTime(startsAt: string, now: Date = new Date()): { date: string; time: string } {
  const eventDate = new Date(startsAt)
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)

  let date: string
  if (isSameDay(eventDate, now)) {
    date = 'Today'
  } else if (isSameDay(eventDate, tomorrow)) {
    date = 'Tomorrow'
  } else {
    date = eventDate.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
  }

  const time = eventDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

  return { date, time }
}

/** One line for the event at the hole: "Tomorrow · 6:00 PM". */
export function formatRelativeEventTime(startsAt: string, now: Date = new Date()): string {
  const { date, time } = formatEventTime(startsAt, now)
  return `${date} · ${time}`
}
