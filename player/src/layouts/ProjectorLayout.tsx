import { useState, useEffect } from 'react'
import { BoardLayout } from '../components/BoardLayout'
import { SecondaryScreenLayout } from '../components/SecondaryScreenLayout'
import { NowPlayingWidget } from '../components/NowPlayingWidget'
import { UpcomingWidget } from '../components/UpcomingWidget'
import { CurrentTimeWidget } from '../components/CurrentTimeWidget'
import { ProjectorOverlays } from '../components/ProjectorOverlays'
import { VisualizationLayer } from '../visualizations'
import { useLocation } from 'react-router-dom'
import { useScreenContext } from '../context/ScreenContext'
import { useKeyboardControls } from '../hooks/useKeyboardControls'
import { useVisualizationControls } from '../hooks/useVisualizationControls'
import { useSleepModeControls } from '../hooks/useSleepModeControls'
import { useDisplayControl } from '../hooks/useDisplayControl'
import { resolveEffectiveLayout } from '../lib/effectiveLayout'
import type { ProjectedMenuDocument } from '../lib/projectedMenu'
import { RabbitHoleLayout } from '../rabbitHole/RabbitHoleLayout'
import type { MenuBoard, SecondaryScreen } from '../types'

interface ProjectorLayoutProps {
  board: MenuBoard
  /** The projected menu `board` was built from; the rabbit hole plans plates from it. */
  document?: ProjectedMenuDocument | null
  announcementBar?: string
  ignoreStockLevels?: boolean
}

/**
 * Projector layout - fullscreen, keyboard-controlled, no scrolling.
 * Uses CSS transitions for smooth screen switching.
 */
export function ProjectorLayout({
  board,
  document,
  announcementBar,
  ignoreStockLevels,
}: ProjectorLayoutProps) {
  const { mode, activeScreen } = useScreenContext()
  const { search } = useLocation()

  // Track the current and previous screens for transitions
  const [displayedScreen, setDisplayedScreen] = useState<SecondaryScreen | null>(activeScreen)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [slideDirection, setSlideDirection] = useState<'in' | 'out'>('in')

  // Keyboard controls only active in projector mode
  useKeyboardControls()
  useVisualizationControls()
  useSleepModeControls()
  const displayControl = useDisplayControl()
  const layout = resolveEffectiveLayout({ search, desiredLayout: displayControl.layout })

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

  if (layout === 'rabbit-hole' && document) {
    return (
      <div className="projector-layout">
        <RabbitHoleLayout document={document} overlays={<ProjectorOverlays />} />
      </div>
    )
  }

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

      <ProjectorOverlays />
    </div>
  )
}
