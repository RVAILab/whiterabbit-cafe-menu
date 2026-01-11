import { useRef, useEffect } from 'react'

interface WaveformsProps {
  /** Number of horizontal lines */
  lineCount?: number
  /** Base color hue (0-360) */
  hue?: number
}

export function Waveforms({
  lineCount = 40,
  hue = 0, // white by default
}: WaveformsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(0)
  const timeRef = useRef(0)

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

    // Generate noise-like data for each line
    const generateLineData = (pointCount: number, seed: number): number[] => {
      const data: number[] = []
      for (let i = 0; i < pointCount; i++) {
        // Create mountain-like peaks using multiple sine waves
        const x = i / pointCount
        const centerDist = Math.abs(x - 0.5) * 2 // 0 at center, 1 at edges
        const envelope = Math.pow(1 - centerDist, 2) // Peaks in center

        // Multiple frequencies for organic look
        const wave1 = Math.sin((x * 8 + seed) * Math.PI) * 0.5
        const wave2 = Math.sin((x * 15 + seed * 1.3) * Math.PI) * 0.3
        const wave3 = Math.sin((x * 25 + seed * 0.7) * Math.PI) * 0.2
        const wave4 = Math.sin((x * 40 + seed * 2.1) * Math.PI) * 0.1

        // Pseudo-random spikes
        const noise = Math.sin(seed * 100 + i * 0.5) * Math.sin(seed * 50 + i * 0.3) * 0.4

        const combined = (wave1 + wave2 + wave3 + wave4 + noise) * envelope
        data.push(combined)
      }
      return data
    }

    // Pre-generate line data
    const pointsPerLine = 200
    const linesData: number[][] = []
    for (let i = 0; i < lineCount; i++) {
      linesData.push(generateLineData(pointsPerLine, i * 0.5))
    }

    const animate = () => {
      timeRef.current += 0.008
      const time = timeRef.current

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const marginX = 0
      const marginY = canvas.height * 0.1
      const drawWidth = canvas.width
      const drawHeight = canvas.height - marginY * 2
      const lineSpacing = drawHeight / lineCount
      const maxAmplitude = lineSpacing * 1.5

      // Draw lines from back to front (top to bottom)
      for (let lineIndex = 0; lineIndex < lineCount; lineIndex++) {
        const baseY = marginY + lineIndex * lineSpacing
        const lineData = linesData[lineIndex]

        // Parallax: lines closer to front (bottom) move faster
        const depth = lineIndex / lineCount // 0 = back (top), 1 = front (bottom)
        const parallaxSpeed = 0.5 + depth * 1.5 // back moves slow, front moves fast
        const parallaxTime = time * parallaxSpeed

        // Animated time offset with parallax
        const timeOffset = Math.sin(parallaxTime + lineIndex * 0.15) * 0.4

        ctx.beginPath()

        for (let i = 0; i < pointsPerLine; i++) {
          const x = marginX + (i / (pointsPerLine - 1)) * drawWidth

          // Add animation with parallax-based speed
          const animatedValue = lineData[i] +
            Math.sin(parallaxTime * 2 + i * 0.05 + lineIndex * 0.2) * 0.15 * (1 - Math.abs(i / pointsPerLine - 0.5) * 2)

          const y = baseY - (animatedValue + timeOffset * 0.3) * maxAmplitude

          if (i === 0) {
            ctx.moveTo(x, y)
          } else {
            ctx.lineTo(x, y)
          }
        }

        // Create fill that covers below the line (for occlusion effect)
        ctx.lineTo(marginX + drawWidth, baseY + lineSpacing)
        ctx.lineTo(marginX, baseY + lineSpacing)
        ctx.closePath()

        // Fill with dark to create occlusion
        ctx.fillStyle = '#0a0a0a'
        ctx.fill()

        // Draw the line stroke
        ctx.beginPath()
        for (let i = 0; i < pointsPerLine; i++) {
          const x = marginX + (i / (pointsPerLine - 1)) * drawWidth
          const animatedValue = lineData[i] +
            Math.sin(parallaxTime * 2 + i * 0.05 + lineIndex * 0.2) * 0.15 * (1 - Math.abs(i / pointsPerLine - 0.5) * 2)
          const y = baseY - (animatedValue + timeOffset * 0.3) * maxAmplitude

          if (i === 0) {
            ctx.moveTo(x, y)
          } else {
            ctx.lineTo(x, y)
          }
        }

        // 45% gray
        ctx.strokeStyle = 'rgb(115, 115, 115)'
        ctx.lineWidth = 1.5
        ctx.stroke()
      }

      animationRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      window.removeEventListener('resize', updateSize)
      cancelAnimationFrame(animationRef.current)
    }
  }, [lineCount, hue])

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
