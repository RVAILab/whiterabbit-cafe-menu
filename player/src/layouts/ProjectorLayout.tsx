import { useState, useEffect } from 'react'
import { BoardLayout } from '../components/BoardLayout'
import { SecondaryScreenLayout } from '../components/SecondaryScreenLayout'
import { NowPlayingWidget } from '../components/NowPlayingWidget'
import { UpcomingWidget } from '../components/UpcomingWidget'
import { CurrentTimeWidget } from '../components/CurrentTimeWidget'
import { SleepModeOverlay } from '../components/SleepModeOverlay'
import { VisualizationLayer } from '../visualizations'
import { useScreenContext } from '../context/ScreenContext'
import { useSleepMode } from '../context/SleepModeContext'
import { useKeyboardControls } from '../hooks/useKeyboardControls'
import { useVisualizationControls } from '../hooks/useVisualizationControls'
import { useSleepModeControls } from '../hooks/useSleepModeControls'
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
  const { isSleepMode } = useSleepMode()

  // Track the current and previous screens for transitions
  const [displayedScreen, setDisplayedScreen] = useState<SecondaryScreen | null>(activeScreen)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [slideDirection, setSlideDirection] = useState<'in' | 'out'>('in')

  // Keyboard controls only active in projector mode
  useKeyboardControls()
  useVisualizationControls()
  useSleepModeControls()

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
  const showNowPlaying = mode === 'primary' && !showSecondary

  return (
    <div className="projector-layout" style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Background visualization layer */}
      <VisualizationLayer />

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

      {/* Bottom widgets container */}
      <div
        style={{
          position: 'fixed',
          bottom: '60px',
          left: 0,
          display: 'flex',
          alignItems: 'flex-end',
          gap: '1vw',
          zIndex: 100,
        }}
      >
        <NowPlayingWidget visible={showNowPlaying} />
        <UpcomingWidget visible={showNowPlaying} />
        <CurrentTimeWidget visible={showNowPlaying} />
      </div>

      {/* Sleep mode overlay */}
      {isSleepMode && <SleepModeOverlay />}
    </div>
  )
}
