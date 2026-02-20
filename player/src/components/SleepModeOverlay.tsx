import { useState, useEffect, useRef } from 'react'
import { Bubbles } from '../visualizations/Bubbles'
import { SparkleText } from './SparkleText'

/**
 * Floating "Zzz" canvas animation - sleepy letters drifting upward
 */
function SleepyZs() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const zsRef = useRef<Z[]>([])
  const animationRef = useRef<number>(0)
  const nextIdRef = useRef(0)

  interface Z {
    id: number
    x: number
    y: number
    size: number
    opacity: number
    vy: number
    vx: number
    wobblePhase: number
    wobbleSpeed: number
    rotation: number
    rotationSpeed: number
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const updateSize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    updateSize()
    window.addEventListener('resize', updateSize)

    const createZ = (): Z => ({
      id: nextIdRef.current++,
      x: canvas.width * 0.3 + Math.random() * canvas.width * 0.4,
      y: canvas.height * 0.45 + Math.random() * 60,
      size: 18 + Math.random() * 28,
      opacity: 0,
      vy: -(0.15 + Math.random() * 0.25),
      vx: 0.3 + Math.random() * 0.4,
      wobblePhase: Math.random() * Math.PI * 2,
      wobbleSpeed: 0.015 + Math.random() * 0.01,
      rotation: -15 + Math.random() * 30,
      rotationSpeed: (Math.random() - 0.5) * 0.3,
    })

    // Start with a few Zs
    zsRef.current = Array.from({ length: 3 }, createZ)

    let spawnTimer = 0

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      spawnTimer++
      if (spawnTimer > 90 && zsRef.current.length < 8) {
        zsRef.current.push(createZ())
        spawnTimer = 0
      }

      const activeZs: Z[] = []

      for (const z of zsRef.current) {
        z.wobblePhase += z.wobbleSpeed
        z.x += z.vx + Math.sin(z.wobblePhase) * 0.3
        z.y += z.vy
        z.rotation += z.rotationSpeed

        // Fade in over first 60 frames, fade out as it rises
        const distanceTraveled = (canvas.height * 0.45 - z.y) / (canvas.height * 0.4)
        if (distanceTraveled < 0.1) {
          z.opacity = Math.min(z.opacity + 0.02, 0.6)
        } else {
          z.opacity = Math.max(0, 0.6 * (1 - distanceTraveled))
        }

        if (z.opacity <= 0 || z.y < -50) continue

        ctx.save()
        ctx.translate(z.x, z.y)
        ctx.rotate((z.rotation * Math.PI) / 180)
        ctx.font = `${Math.round(z.size)}px "PP Pangram Sans Rounded", sans-serif`
        ctx.fillStyle = `rgba(180, 160, 255, ${z.opacity})`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('z', 0, 0)
        ctx.restore()

        activeZs.push(z)
      }

      zsRef.current = activeZs
      animationRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      window.removeEventListener('resize', updateSize)
      cancelAnimationFrame(animationRef.current)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    />
  )
}

/** Dreamy blue/purple/lavender palette — stable reference to avoid re-renders */
const SLEEP_HUES = [240, 255, 270, 285, 300, 220, 200]

/**
 * Sleep Mode overlay - displayed when the barista is away.
 * Features dreamy bubbles, floating Zzz's, and a whimsical message.
 *
 * Toggle with the `0` key.
 */
export function SleepModeOverlay() {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [visible, setVisible] = useState(false)

  // Trigger fade-in after mount
  useEffect(() => {
    const timer = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(timer)
  }, [])

  // Update clock every second
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  const timeString = currentTime.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <>
      <style>
        {`
          @keyframes sleep-breathe {
            0%, 100% { opacity: 0.6; transform: scale(1); }
            50% { opacity: 1; transform: scale(1.02); }
          }

          @keyframes sleep-clock-pulse {
            0%, 100% { opacity: 0.4; }
            50% { opacity: 0.6; }
          }

          @keyframes sleep-fade-in {
            from { opacity: 0; }
            to { opacity: 1; }
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
        {/* Dreamy bubbles - slower, cooler palette */}
        <Bubbles
          bubbleCount={14}
          minRadius={30}
          maxRadius={200}
          riseSpeed={0.25}
          hues={SLEEP_HUES}
          minLifetime={1800}
          maxLifetimeVariance={1800}
        />

        {/* Floating Zzz's */}
        <SleepyZs />

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
            animation: 'sleep-fade-in 1.5s ease-out',
          }}
        >
          {/* Main message */}
          <SparkleText
            sparkleColor="#b4a0ff"
            sparkleCount={6}
            sparkleInterval={200}
            style={{
              color: '#b4a0ff',
              fontSize: '5vw',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            Down the Rabbit Hole
          </SparkleText>

          {/* Subtitle */}
          <div
            style={{
              fontSize: '1.8vw',
              fontWeight: 300,
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              color: '#ffffff',
              animation: 'sleep-breathe 4s ease-in-out infinite',
            }}
          >
            Your barista will return shortly
          </div>

          {/* Clock */}
          <div
            style={{
              fontSize: '8vw',
              fontWeight: 100,
              letterSpacing: '0.1em',
              color: '#ffffff',
              animation: 'sleep-clock-pulse 5s ease-in-out infinite',
              marginTop: '2vw',
            }}
          >
            {timeString}
          </div>
        </div>
      </div>
    </>
  )
}
