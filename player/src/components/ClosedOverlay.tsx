import { useState, useEffect } from 'react'
import { Bubbles } from '../visualizations/Bubbles'
import { SparkleText } from './SparkleText'

/** Warm sunset palette for the closed screen */
const CLOSED_HUES = [340, 350, 10, 20, 30, 280, 310]

/**
 * Closed Mode overlay - displayed when the cafe is closed for the day.
 * Features warm-toned bubbles and a whimsical goodbye message.
 *
 * Toggle with the `9` key.
 */
export function ClosedOverlay() {
  const [visible, setVisible] = useState(false)

  // Trigger fade-in after mount
  useEffect(() => {
    const timer = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(timer)
  }, [])

  return (
    <>
      <style>
        {`
          @keyframes closed-breathe {
            0%, 100% { opacity: 0.6; transform: scale(1); }
            50% { opacity: 1; transform: scale(1.02); }
          }

          @keyframes closed-fade-in {
            from { opacity: 0; }
            to { opacity: 1; }
          }

          @keyframes closed-moon-glow {
            0%, 100% { text-shadow: 0 0 20px rgba(255, 180, 100, 0.3); }
            50% { text-shadow: 0 0 40px rgba(255, 180, 100, 0.6); }
          }
        `}
      </style>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          background: '#0a0a0a',
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.8s ease-in-out',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Warm bubbles */}
        <Bubbles
          bubbleCount={14}
          minRadius={30}
          maxRadius={200}
          riseSpeed={0.15}
          hues={CLOSED_HUES}
          minLifetime={2200}
          maxLifetimeVariance={1800}
        />

        {/* Center content */}
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '2.5vw',
            animation: 'closed-fade-in 1.5s ease-out',
          }}
        >
          {/* Moon emoji */}
          <div
            style={{
              fontSize: '6vw',
              animation: 'closed-moon-glow 4s ease-in-out infinite',
            }}
          >
            🌙
          </div>

          {/* Main message */}
          <SparkleText
            sparkleColor="#ffb464"
            sparkleCount={6}
            sparkleInterval={200}
            style={{
              color: '#ffb464',
              fontSize: '5vw',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            The Rabbit Has Retired
          </SparkleText>

          {/* Subtitle */}
          <div
            style={{
              fontSize: '1.8vw',
              fontWeight: 300,
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              color: '#ffffff',
              animation: 'closed-breathe 4s ease-in-out infinite',
            }}
          >
            We're closed for today — see you tomorrow
          </div>
        </div>
      </div>
    </>
  )
}
