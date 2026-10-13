import { useEffect, useState } from 'react'
import { CAFE_HOURS, CLUBHOUSE_HOURS, cafeHeadline } from '../lib/cafeHours'
import { getHoleVariant } from './holeVariants'

const REFRESH_MS = 60_000

interface ClubhouseNoticeProps {
  /** The active hole variant id; its `holeCenter` places the notice. */
  variant: string
}

/**
 * The clubhouse overlay in the rabbit hole: the café is closed, the clubhouse
 * is open. Takes the hole event's place at the hole center, inside the pinned
 * stage, while the menu stays up (dimmed by the stage's `clubhouse` class).
 */
export function ClubhouseNotice({ variant }: ClubhouseNoticeProps) {
  const { holeCenter: [x, y] } = getHoleVariant(variant)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), REFRESH_MS)
    return () => window.clearInterval(interval)
  }, [])

  return (
    <div className="rh-clubhouse" data-testid="rh-clubhouse" style={{ left: `${x}px`, top: `${y}px` }}>
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
