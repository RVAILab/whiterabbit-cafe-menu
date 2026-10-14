import { useEffect, useState } from 'react'
import { CAFE_HOURS, CLUBHOUSE_HOURS, cafeHeadline } from '../lib/cafeHours'

const REFRESH_MS = 60_000

/**
 * The clubhouse overlay in the rabbit hole: the café is closed, the clubhouse
 * is open. A plate at the bottom of the menu's column 3, inside the pinned
 * stage, while the rest of the menu stays up (dimmed by the stage's
 * `clubhouse` class).
 */
export function ClubhouseNotice() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), REFRESH_MS)
    return () => window.clearInterval(interval)
  }, [])

  return (
    <div className="rh-clubhouse" data-testid="rh-clubhouse">
      <small className="rh-clubhouse-label">Clubhouse open</small>
      <strong className="rh-clubhouse-title">{cafeHeadline(now)}</strong>
      <dl className="rh-clubhouse-hours">
        <div>
          <dt>Café</dt>
          <dd>{CAFE_HOURS}</dd>
        </div>
        <div>
          <dt>Clubhouse</dt>
          <dd>{CLUBHOUSE_HOURS}</dd>
        </div>
      </dl>
    </div>
  )
}
