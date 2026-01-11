import { useRef, useEffect, useCallback } from 'react'

interface Bubble {
  id: number
  x: number
  y: number
  radius: number
  vx: number // horizontal velocity
  vy: number // vertical velocity (negative = upward)
  opacity: number
  hue: number // color hue (0-360)
  wobblePhase: number // for gentle horizontal wobble
  wobbleSpeed: number
  lifetime: number // frames until natural pop
  maxLifetime: number
  popping: boolean
  popProgress: number
}

interface BubblesProps {
  /** Number of bubbles to maintain on screen */
  bubbleCount?: number
  /** Minimum bubble radius */
  minRadius?: number
  /** Maximum bubble radius */
  maxRadius?: number
  /** Base upward speed */
  riseSpeed?: number
  /** Color palette - array of hue values (0-360) */
  hues?: number[]
}

export function Bubbles({
  bubbleCount = 21,
  minRadius = 20,
  maxRadius = 150,
  riseSpeed = 0.5,
  hues = [330, 350, 140, 160, 0, 30, 60, 180, 210, 270, 300], // pink, green, rainbow spectrum
}: BubblesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const bubblesRef = useRef<Bubble[]>([])
  const animationRef = useRef<number>(0)
  const nextIdRef = useRef(0)

  const createBubble = useCallback((width: number, height: number, startFromBottom = true): Bubble => {
    const radius = minRadius + Math.random() * (maxRadius - minRadius)
    const hue = hues[Math.floor(Math.random() * hues.length)]

    return {
      id: nextIdRef.current++,
      x: Math.random() * width,
      y: startFromBottom ? height + radius : Math.random() * height,
      radius,
      vx: (Math.random() - 0.5) * 0.3,
      vy: -(riseSpeed + Math.random() * riseSpeed * 0.5),
      opacity: 0.35 + Math.random() * 0.35,
      hue,
      wobblePhase: Math.random() * Math.PI * 2,
      wobbleSpeed: 0.02 + Math.random() * 0.02,
      lifetime: 0,
      maxLifetime: 300 + Math.random() * 400, // 5-12 seconds at 60fps
      popping: false,
      popProgress: 0,
    }
  }, [minRadius, maxRadius, riseSpeed, hues])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    const updateSize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    updateSize()
    window.addEventListener('resize', updateSize)

    // Initialize bubbles
    bubblesRef.current = Array.from({ length: bubbleCount }, () =>
      createBubble(canvas.width, canvas.height, false)
    )

    const drawBubble = (bubble: Bubble) => {
      const { x, y, radius, opacity, hue, popping, popProgress } = bubble

      // Calculate current radius (shrinks when popping)
      const currentRadius = popping
        ? radius * (1 - popProgress * 0.3)
        : radius

      // Calculate current opacity (fades when popping)
      const currentOpacity = popping
        ? opacity * (1 - popProgress)
        : opacity

      if (currentOpacity <= 0 || currentRadius <= 0) return

      // Main bubble body
      const gradient = ctx.createRadialGradient(
        x - currentRadius * 0.3,
        y - currentRadius * 0.3,
        0,
        x,
        y,
        currentRadius
      )
      gradient.addColorStop(0, `hsla(${hue}, 40%, 65%, ${currentOpacity * 0.7})`)
      gradient.addColorStop(0.5, `hsla(${hue}, 35%, 50%, ${currentOpacity * 0.4})`)
      gradient.addColorStop(1, `hsla(${hue}, 30%, 35%, ${currentOpacity * 0.15})`)

      ctx.beginPath()
      ctx.arc(x, y, currentRadius, 0, Math.PI * 2)
      ctx.fillStyle = gradient
      ctx.fill()

      // Highlight shine
      const shineGradient = ctx.createRadialGradient(
        x - currentRadius * 0.4,
        y - currentRadius * 0.4,
        0,
        x - currentRadius * 0.4,
        y - currentRadius * 0.4,
        currentRadius * 0.5
      )
      shineGradient.addColorStop(0, `hsla(0, 0%, 100%, ${currentOpacity * 0.6})`)
      shineGradient.addColorStop(1, `hsla(0, 0%, 100%, 0)`)

      ctx.beginPath()
      ctx.arc(x - currentRadius * 0.3, y - currentRadius * 0.3, currentRadius * 0.35, 0, Math.PI * 2)
      ctx.fillStyle = shineGradient
      ctx.fill()

      // Rim highlight
      ctx.beginPath()
      ctx.arc(x, y, currentRadius, 0, Math.PI * 2)
      ctx.strokeStyle = `hsla(${hue}, 35%, 55%, ${currentOpacity * 0.25})`
      ctx.lineWidth = 2
      ctx.stroke()

      // Pop effect particles
      if (popping && popProgress > 0.2) {
        const particleCount = 6
        for (let i = 0; i < particleCount; i++) {
          const angle = (i / particleCount) * Math.PI * 2
          const distance = currentRadius * (1 + popProgress * 2)
          const px = x + Math.cos(angle) * distance
          const py = y + Math.sin(angle) * distance
          const particleSize = 3 * (1 - popProgress)

          ctx.beginPath()
          ctx.arc(px, py, particleSize, 0, Math.PI * 2)
          ctx.fillStyle = `hsla(${hue}, 70%, 80%, ${(1 - popProgress) * 0.5})`
          ctx.fill()
        }
      }
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const bubbles = bubblesRef.current
      const activeBubbles: Bubble[] = []

      for (const bubble of bubbles) {
        if (bubble.popping) {
          bubble.popProgress += 0.05
          if (bubble.popProgress >= 1) {
            // Bubble fully popped, don't keep it
            continue
          }
        } else {
          // Update position
          bubble.wobblePhase += bubble.wobbleSpeed
          const wobble = Math.sin(bubble.wobblePhase) * 0.5

          bubble.x += bubble.vx + wobble
          bubble.y += bubble.vy
          bubble.lifetime++

          // Check if bubble should pop
          const shouldPop =
            bubble.y + bubble.radius < 0 || // went off top
            bubble.lifetime > bubble.maxLifetime // lived too long

          if (shouldPop) {
            bubble.popping = true
            bubble.popProgress = 0
          }

          // Wrap horizontally
          if (bubble.x < -bubble.radius) {
            bubble.x = canvas.width + bubble.radius
          } else if (bubble.x > canvas.width + bubble.radius) {
            bubble.x = -bubble.radius
          }
        }

        drawBubble(bubble)
        activeBubbles.push(bubble)
      }

      // Spawn new bubbles to maintain count
      while (activeBubbles.length < bubbleCount) {
        activeBubbles.push(createBubble(canvas.width, canvas.height, true))
      }

      bubblesRef.current = activeBubbles
      animationRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      window.removeEventListener('resize', updateSize)
      cancelAnimationFrame(animationRef.current)
    }
  }, [bubbleCount, createBubble])

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
