import { useState, useEffect } from 'react'

interface CurrentTimeWidgetProps {
  visible: boolean
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

export function CurrentTimeWidget({ visible }: CurrentTimeWidgetProps) {
  const [currentTime, setCurrentTime] = useState(() => new Date())

  useEffect(() => {
    if (!visible) return

    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(interval)
  }, [visible])

  if (!visible) {
    return null
  }

  return (
    <div
      style={{
        fontSize: '1.1vw',
        color: 'rgba(255, 255, 255, 0.7)',
        fontWeight: '300',
        letterSpacing: '0.08em',
      }}
    >
      {formatTime(currentTime)}
    </div>
  )
}
