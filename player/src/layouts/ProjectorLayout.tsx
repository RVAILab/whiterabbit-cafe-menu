import { useState, useEffect } from 'react'
import { BoardLayout } from '../components/BoardLayout'
import { SecondaryScreenLayout } from '../components/SecondaryScreenLayout'
import { useScreenContext } from '../context/ScreenContext'
import { useKeyboardControls } from '../hooks/useKeyboardControls'
import type { MenuBoard, SecondaryScreen } from '../types'

interface ProjectorLayoutProps {
  board: MenuBoard
  announcementBar?: string
  ignoreStockLevels?: boolean
}

/**
 * Projector layout - fullscreen, keyboard-controlled, no scrolling.
 * Uses CSS transitions for smooth screen switching.
 */
export function ProjectorLayout({
  board,
  announcementBar,
  ignoreStockLevels,
}: ProjectorLayoutProps) {
  const { mode, activeScreen } = useScreenContext()

  // Track the current and previous screens for transitions
  const [displayedScreen, setDisplayedScreen] = useState<SecondaryScreen | null>(activeScreen)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [slideDirection, setSlideDirection] = useState<'in' | 'out'>('in')

  // Keyboard controls only active in projector mode
  useKeyboardControls()

  // Handle screen transitions
  useEffect(() => {
    if (mode === 'secondary' && activeScreen) {
      // Switching to secondary screen
      setSlideDirection('in')
      setDisplayedScreen(activeScreen)
      setIsTransitioning(true)
      const timer = setTimeout(() => setIsTransitioning(false), 50)
      return () => clearTimeout(timer)
    } else if (mode === 'primary') {
      // Returning to primary
      setSlideDirection('out')
      setIsTransitioning(true)
      const timer = setTimeout(() => {
        setDisplayedScreen(null)
        setIsTransitioning(false)
      }, 400) // Match CSS transition duration
      return () => clearTimeout(timer)
    }
  }, [mode, activeScreen])

  const showSecondary = mode === 'secondary' || displayedScreen !== null

  return (
    <div className="projector-layout" style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Primary screen - always rendered, slides left when secondary is shown */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: showSecondary && slideDirection === 'in' && !isTransitioning
            ? 'translateX(-100%)'
            : 'translateX(0)',
          transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <BoardLayout
          board={board}
          announcementBar={announcementBar}
          ignoreStockLevels={ignoreStockLevels}
        />
      </div>

      {/* Secondary screen - slides in from right */}
      {displayedScreen && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            transform: slideDirection === 'out' || isTransitioning
              ? 'translateX(100%)'
              : 'translateX(0)',
            transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <SecondaryScreenLayout screen={displayedScreen} />
        </div>
      )}
    </div>
  )
}
