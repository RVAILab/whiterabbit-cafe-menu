import { BoardLayout } from '../components/BoardLayout'
import { SecondaryScreenLayout } from '../components/SecondaryScreenLayout'
import { useScreenContext } from '../context/ScreenContext'
import { useKeyboardControls } from '../hooks/useKeyboardControls'
import { AnimatePresence, motion } from 'framer-motion'
import type { MenuBoard } from '../types'

// Transition variants for screen switching - sliding/bumping effect
const primaryVariants = {
  initial: { x: '-100%' },
  animate: { x: 0 },
  exit: { x: '-100%' },
}

const secondaryVariants = {
  initial: { x: '100%' },
  animate: { x: 0 },
  exit: { x: '100%' },
}

const transition = {
  type: 'spring' as const,
  stiffness: 300,
  damping: 22,
}

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
    <div
      className="projector-layout"
      style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}
    >
      <AnimatePresence initial={false}>
        {mode === 'secondary' && activeScreen ? (
          <motion.div
            key="secondary"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: '100%',
              height: '100%',
            }}
            initial="initial"
            animate="animate"
            exit="exit"
            variants={secondaryVariants}
            transition={transition}
          >
            <SecondaryScreenLayout screen={activeScreen} />
          </motion.div>
        ) : (
          <motion.div
            key="primary"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: '100%',
              height: '100%',
            }}
            initial="initial"
            animate="animate"
            exit="exit"
            variants={primaryVariants}
            transition={transition}
          >
            <BoardLayout
              board={board}
              announcementBar={announcementBar}
              ignoreStockLevels={ignoreStockLevels}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
