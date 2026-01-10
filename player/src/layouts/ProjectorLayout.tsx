import { BoardLayout } from '../components/BoardLayout'
import { SecondaryScreenLayout } from '../components/SecondaryScreenLayout'
import { useScreenContext } from '../context/ScreenContext'
import { useKeyboardControls } from '../hooks/useKeyboardControls'
import type { MenuBoard } from '../types'

interface ProjectorLayoutProps {
  board: MenuBoard
  announcementBar?: string
  ignoreStockLevels?: boolean
}

/**
 * Projector layout - fullscreen, keyboard-controlled, no scrolling.
 * Used at /projection route.
 */
export function ProjectorLayout({
  board,
  announcementBar,
  ignoreStockLevels,
}: ProjectorLayoutProps) {
  const { mode, activeScreen } = useScreenContext()

  // Keyboard controls only active in projector mode
  useKeyboardControls()

  return (
    <div className="projector-layout">
      {mode === 'secondary' && activeScreen ? (
        <SecondaryScreenLayout screen={activeScreen} />
      ) : (
        <BoardLayout
          board={board}
          announcementBar={announcementBar}
          ignoreStockLevels={ignoreStockLevels}
        />
      )}
    </div>
  )
}
