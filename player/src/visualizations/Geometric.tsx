import { useRef, useEffect, useCallback } from 'react'

interface Shape {
  id: number
  x: number
  y: number
  rotation: number
  rotationSpeed: number
  scale: number
  scaleDirection: number
  sides: number
  radius: number
  hue: number
  opacity: number
  vx: number
  vy: number
}

interface GeometricProps {
  /** Number of shapes */
  shapeCount?: number
  /** Connection distance threshold */
  connectionDistance?: number
  /** Color palette - array of hue values (0-360) */
  hues?: number[]
}

export function Geometric({
  shapeCount = 12,
  connectionDistance = 250,
  hues = [320, 280, 200, 40], // pink, purple, cyan, gold
}: GeometricProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const shapesRef = useRef<Shape[]>([])
  const animationRef = useRef<number>(0)
  const nextIdRef = useRef(0)

  const createShape = useCallback((width: number, height: number): Shape => {
    const sides = 3 + Math.floor(Math.random() * 4) // 3-6 sides
    const hue = hues[Math.floor(Math.random() * hues.length)]

    return {
      id: nextIdRef.current++,
      x: Math.random() * width,
      y: Math.random() * height,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.02,
      scale: 0.8 + Math.random() * 0.4,
      scaleDirection: Math.random() > 0.5 ? 1 : -1,
      sides,
      radius: 30 + Math.random() * 50,
      hue,
      opacity: 0.15 + Math.random() * 0.2,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
    }
  }, [hues])

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

    // Initialize shapes
    shapesRef.current = Array.from({ length: shapeCount }, () =>
      createShape(canvas.width, canvas.height)
    )

    const getPolygonVertices = (shape: Shape): { x: number; y: number }[] => {
      const vertices: { x: number; y: number }[] = []
      const { x, y, rotation, scale, sides, radius } = shape
      const scaledRadius = radius * scale

      for (let i = 0; i < sides; i++) {
        const angle = rotation + (i / sides) * Math.PI * 2
        vertices.push({
          x: x + Math.cos(angle) * scaledRadius,
          y: y + Math.sin(angle) * scaledRadius,
        })
      }
      return vertices
    }

    const drawShape = (shape: Shape) => {
      const { hue, opacity } = shape
      const vertices = getPolygonVertices(shape)

      if (vertices.length === 0) return

      // Draw filled polygon with gradient
      ctx.beginPath()
      ctx.moveTo(vertices[0].x, vertices[0].y)
      for (let i = 1; i < vertices.length; i++) {
        ctx.lineTo(vertices[i].x, vertices[i].y)
      }
      ctx.closePath()

      // Subtle fill
      ctx.fillStyle = `hsla(${hue}, 60%, 50%, ${opacity * 0.3})`
      ctx.fill()

      // Glowing stroke
      ctx.strokeStyle = `hsla(${hue}, 70%, 60%, ${opacity})`
      ctx.lineWidth = 2
      ctx.stroke()

      // Inner glow effect
      ctx.strokeStyle = `hsla(${hue}, 80%, 80%, ${opacity * 0.5})`
      ctx.lineWidth = 1
      ctx.stroke()
    }

    const drawConnections = (shapes: Shape[]) => {
      for (let i = 0; i < shapes.length; i++) {
        for (let j = i + 1; j < shapes.length; j++) {
          const a = shapes[i]
          const b = shapes[j]
          const dx = b.x - a.x
          const dy = b.y - a.y
          const distance = Math.sqrt(dx * dx + dy * dy)

          if (distance < connectionDistance) {
            const opacity = (1 - distance / connectionDistance) * 0.15
            const hue = (a.hue + b.hue) / 2

            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.strokeStyle = `hsla(${hue}, 50%, 60%, ${opacity})`
            ctx.lineWidth = 1
            ctx.stroke()
          }
        }
      }
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const shapes = shapesRef.current

      // Draw connections first (behind shapes)
      drawConnections(shapes)

      // Update and draw shapes
      for (const shape of shapes) {
        // Update rotation
        shape.rotation += shape.rotationSpeed

        // Update scale (pulsing)
        shape.scale += shape.scaleDirection * 0.002
        if (shape.scale > 1.2 || shape.scale < 0.6) {
          shape.scaleDirection *= -1
        }

        // Update position
        shape.x += shape.vx
        shape.y += shape.vy

        // Wrap around edges
        if (shape.x < -shape.radius) shape.x = canvas.width + shape.radius
        if (shape.x > canvas.width + shape.radius) shape.x = -shape.radius
        if (shape.y < -shape.radius) shape.y = canvas.height + shape.radius
        if (shape.y > canvas.height + shape.radius) shape.y = -shape.radius

        drawShape(shape)
      }

      animationRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      window.removeEventListener('resize', updateSize)
      cancelAnimationFrame(animationRef.current)
    }
  }, [shapeCount, connectionDistance, createShape])

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
