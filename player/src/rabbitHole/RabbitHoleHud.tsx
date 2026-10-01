import { useEffect, useState } from 'react'
import { formatClockTime } from '../lib/time'

const HUD_REFRESH_MS = 15_000

export function RabbitHoleHud() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), HUD_REFRESH_MS)
    return () => window.clearInterval(interval)
  }, [])

  return (
    <div className="rh-hud" data-testid="rabbit-hole-hud">
      {`Members 15% off · ${formatClockTime(now)}`}
    </div>
  )
}
