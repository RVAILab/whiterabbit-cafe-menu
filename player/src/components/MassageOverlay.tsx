import { useState, useEffect } from 'react'
import { Bubbles } from '../visualizations/Bubbles'
import { SparkleText } from './SparkleText'

/** Spa palette — eucalyptus, sage, seafoam, a little lavender */
const MASSAGE_HUES = [150, 160, 170, 180, 190, 120, 260]

/**
 * Massage Mode overlay - displayed when the cafe is closed for a few days.
 * Softer than the nightly closed screen: it needs to tell walk-ups that this
 * is a multi-day break, not "see you tomorrow".
 *
 * Toggle with the `8` key.
 */
export function MassageOverlay() {
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
          @keyframes massage-breathe {
            0%, 100% { opacity: 0.6; transform: scale(1); }
            50% { opacity: 1; transform: scale(1.02); }
          }

          @keyframes massage-fade-in {
            from { opacity: 0; }
            to { opacity: 1; }
          }

          @keyframes massage-glow {
            0%, 100% { text-shadow: 0 0 20px rgba(140, 230, 190, 0.3); }
            50% { text-shadow: 0 0 40px rgba(140, 230, 190, 0.6); }
          }

          @keyframes massage-sway {
            0%, 100% { transform: rotate(-3deg); }
            50% { transform: rotate(3deg); }
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
        {/* Slow, spa-toned bubbles */}
        <Bubbles
          bubbleCount={14}
          minRadius={30}
          maxRadius={200}
          riseSpeed={0.12}
          hues={MASSAGE_HUES}
          minLifetime={2600}
          maxLifetimeVariance={2000}
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
            animation: 'massage-fade-in 1.5s ease-out',
          }}
        >
          {/* Spa emoji */}
          <div
            style={{
              fontSize: '6vw',
              animation: 'massage-glow 4s ease-in-out infinite, massage-sway 6s ease-in-out infinite',
            }}
          >
            💆
          </div>

          {/* Main message */}
          <SparkleText
            sparkleColor="#8ce6be"
            sparkleCount={6}
            sparkleInterval={200}
            style={{
              color: '#8ce6be',
              fontSize: '5vw',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            The Cafe Is Having a Massage
          </SparkleText>

          {/* Subtitle — the part that matters: this is a multi-day break */}
          <div
            style={{
              fontSize: '1.8vw',
              fontWeight: 300,
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              color: '#ffffff',
              animation: 'massage-breathe 4s ease-in-out infinite',
            }}
          >
            We're closed for a few days — back soon, rested and refreshed
          </div>
        </div>
      </div>
    </>
  )
}
