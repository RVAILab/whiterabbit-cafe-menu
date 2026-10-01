import { useUpcomingEvent } from '../hooks/useUpcomingEvent'
import { formatEventTime } from '../lib/eventTime'

interface UpcomingWidgetProps {
  visible: boolean
}

export function UpcomingWidget({ visible }: UpcomingWidgetProps) {
  const { upcomingEvent, isLoading, error } = useUpcomingEvent({
    enabled: visible,
    pollInterval: parseInt(import.meta.env.VITE_ROVA_POLL_INTERVAL || '60000', 10),
  })

  if (!visible || isLoading || error || !upcomingEvent) {
    return null
  }

  const { date, time } = formatEventTime(upcomingEvent.startsAt)

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '1vw',
        padding: '1vw',
        backgroundColor: 'rgba(10, 10, 10, 0.9)',
        borderRadius: '0.5vw',
        border: '2px solid rgba(255, 255, 255, 0.3)',
        // Two menu columns (the board is a 4-column grid), so long event
        // titles stop truncating; ellipsis remains as the overflow fallback.
        maxWidth: '50vw',
        fontFamily: "'PP Pangram Sans Rounded', system-ui, sans-serif",
      }}
    >
      {upcomingEvent.imageUrl && (
        <img
          src={upcomingEvent.imageUrl}
          alt="Event image"
          style={{
            width: '4vw',
            height: '4vw',
            borderRadius: '0.3vw',
            objectFit: 'cover',
            flexShrink: 0,
          }}
        />
      )}

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.2vw',
          overflow: 'hidden',
          minWidth: 0,
        }}
      >
        <span
          style={{
            fontSize: '0.8vw',
            fontWeight: 700,
            color: '#7ed957',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          Next at White Rabbit
        </span>

        <span
          style={{
            fontSize: '1.2vw',
            fontWeight: 700,
            color: '#ffffff',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {upcomingEvent.title}
        </span>

        <span
          style={{
            fontSize: '1vw',
            fontWeight: 700,
            color: '#ff4d9f',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {date} at {time}
        </span>
      </div>
    </div>
  )
}
