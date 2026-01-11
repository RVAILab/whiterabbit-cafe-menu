import { useState, useEffect, useCallback, useRef } from 'react'

interface Sparkle {
  id: number
  x: number
  y: number
  size: number
  opacity: number
  rotation: number
}

interface SparkleTextProps {
  children: React.ReactNode
  style?: React.CSSProperties
  className?: string
  sparkleColor?: string
  sparkleCount?: number
  sparkleInterval?: number
}

const generateSparkle = (containerWidth: number, containerHeight: number): Sparkle => ({
  id: Date.now() + Math.random(),
  x: Math.random() * containerWidth,
  y: Math.random() * containerHeight,
  size: Math.random() * 18 + 10,
  opacity: Math.random() * 0.4 + 0.6,
  rotation: Math.random() * 360
})

const SparkleIcon = ({ size, color, opacity, rotation }: { size: number; color: string; opacity: number; rotation: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    style={{
      opacity,
      transform: `rotate(${rotation}deg)`,
      animation: 'sparkle-fade 700ms ease-out forwards'
    }}
  >
    <path
      d="M12 0L13.5 9L22 12L13.5 15L12 24L10.5 15L2 12L10.5 9L12 0Z"
      fill={color}
    />
  </svg>
)

export function SparkleText({
  children,
  style,
  className,
  sparkleColor = '#fbbf24',
  sparkleCount = 8,
  sparkleInterval = 150
}: SparkleTextProps) {
  const [sparkles, setSparkles] = useState<Sparkle[]>([])
  const containerRef = useRef<HTMLSpanElement>(null)
  const intervalRef = useRef<number | null>(null)

  const addSparkle = useCallback(() => {
    if (!containerRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    const newSparkle = generateSparkle(rect.width, rect.height)

    setSparkles(prev => [...prev, newSparkle])

    // Remove sparkle after animation completes
    setTimeout(() => {
      setSparkles(prev => prev.filter(s => s.id !== newSparkle.id))
    }, 700)
  }, [])

  useEffect(() => {
    // Add initial sparkles with slight delay
    for (let i = 0; i < sparkleCount; i++) {
      setTimeout(() => addSparkle(), i * 150)
    }

    // Continue adding sparkles at interval
    intervalRef.current = window.setInterval(addSparkle, sparkleInterval)

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current)
      }
    }
  }, [addSparkle, sparkleCount, sparkleInterval])

  return (
    <>
      <style>
        {`
          @keyframes sparkle-fade {
            0% {
              transform: scale(0) rotate(0deg);
              opacity: 0;
            }
            50% {
              transform: scale(1) rotate(90deg);
              opacity: 1;
            }
            100% {
              transform: scale(0) rotate(180deg);
              opacity: 0;
            }
          }

          @keyframes shimmer-sweep {
            0% {
              background-position: 100% center;
            }
            100% {
              background-position: -100% center;
            }
          }
        `}
      </style>
      <span
        ref={containerRef}
        className={className}
        style={{
          position: 'relative',
          display: 'inline-block',
          ...style
        }}
      >
        {/* Shimmer text layer - sweeps left to right from black to yellow */}
        <span
          style={{
            background: `linear-gradient(
              90deg,
              ${style?.color || '#fbbf24'} 0%,
              ${style?.color || '#fbbf24'} 40%,
              #000000 50%,
              ${style?.color || '#fbbf24'} 60%,
              ${style?.color || '#fbbf24'} 100%
            )`,
            backgroundSize: '300% 100%',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            animation: 'shimmer-sweep 5s linear infinite',
            display: 'inline-block'
          }}
        >
          {children}
        </span>

        {/* Floating sparkles */}
        {sparkles.map(sparkle => (
          <span
            key={sparkle.id}
            style={{
              position: 'absolute',
              left: sparkle.x,
              top: sparkle.y,
              pointerEvents: 'none',
              zIndex: 10
            }}
          >
            <SparkleIcon
              size={sparkle.size}
              color={sparkleColor}
              opacity={sparkle.opacity}
              rotation={sparkle.rotation}
            />
          </span>
        ))}
      </span>
    </>
  )
}
