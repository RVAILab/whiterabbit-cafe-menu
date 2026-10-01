import { useUpcomingEvent } from '../hooks/useUpcomingEvent'
import { formatRelativeEventTime } from '../lib/eventTime'
import { getHoleVariant } from './holeVariants'

const FALLBACK_LABEL = 'White Rabbit'
const FALLBACK_TITLE = "We're all mad here"

interface HoleEventProps {
  /** The active hole variant id; its `eventLabel` and `holeCenter` place the block. */
  variant: string
}

/**
 * The next White Rabbit event at the bottom of the hole (SPEC §5), centered on
 * the variant's hole center. With no upcoming event (or Rova unreachable) it
 * reads "White Rabbit / We're all mad here", so the hole never looks empty.
 * Until the first Rova request settles it is empty, so the fallback never
 * flashes before a real event.
 *
 * The block carries `.rh-hole-event` (testid `rh-hole-event`) for the gulp to
 * fade it out and back in; it has no fade of its own.
 */
export function HoleEvent({ variant }: HoleEventProps) {
  const { holeCenter: [x, y], eventLabel } = getHoleVariant(variant)
  const { upcomingEvent, isLoading } = useUpcomingEvent({
    enabled: true,
    pollInterval: parseInt(import.meta.env.VITE_ROVA_POLL_INTERVAL || '60000', 10),
  })

  const style = { left: `${x}px`, top: `${y}px` }
  if (isLoading) return <div className="rh-hole-event" data-testid="rh-hole-event" style={style} />

  return (
    <div className="rh-hole-event" data-testid="rh-hole-event" style={style}>
      <small className="rh-hole-event-label">{upcomingEvent ? eventLabel : FALLBACK_LABEL}</small>
      <strong className="rh-hole-event-title">{upcomingEvent ? upcomingEvent.title : FALLBACK_TITLE}</strong>
      {upcomingEvent && (
        <span className="rh-hole-event-time">{formatRelativeEventTime(upcomingEvent.startsAt)}</span>
      )}
    </div>
  )
}
