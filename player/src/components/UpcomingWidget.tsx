import { useUpcomingEvent } from '../hooks/useUpcomingEvent'

interface UpcomingWidgetProps {
  visible: boolean
}

function formatEventTime(startsAt: string): { date: string; time: string } {
  const eventDate = new Date(startsAt)
  const now = new Date()

  // Check if it's today
  const isToday =
    eventDate.getFullYear() === now.getFullYear() &&
    eventDate.getMonth() === now.getMonth() &&
    eventDate.getDate() === now.getDate()

  // Check if it's tomorrow
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const isTomorrow =
    eventDate.getFullYear() === tomorrow.getFullYear() &&
    eventDate.getMonth() === tomorrow.getMonth() &&
    eventDate.getDate() === tomorrow.getDate()

  let date: string
  if (isToday) {
    date = 'Today'
  } else if (isTomorrow) {
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
        maxWidth: '25vw',
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
