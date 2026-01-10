import { useMenuData } from './hooks/useMenuData'
import { BoardLayout } from './components/BoardLayout'
import { SecondaryScreenLayout } from './components/SecondaryScreenLayout'
import { ScreenProvider, useScreenContext } from './context/ScreenContext'
import { useKeyboardControls } from './hooks/useKeyboardControls'
import { AnimatePresence, motion } from 'framer-motion'
import type { MenuBoard } from './types'

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

function App() {
  const { kioskSettings, secondaryScreens, isLoading, error } = useMenuData()

  // Debug logging
  console.log('🔍 App render:', {
    isLoading,
    hasKioskSettings: !!kioskSettings,
    hasActiveBoard: !!kioskSettings?.activeBoard,
    sectionsCount: kioskSettings?.activeBoard?.sections?.length,
    secondaryScreensCount: secondaryScreens.length,
    error
  })

  // Loading state
  if (isLoading && !kioskSettings) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center">
          <div
            className="animate-pulse mb-4"
            style={{ fontSize: 'var(--font-size-2xl)' }}
          >
            Loading Menu...
          </div>
          <div className="w-16 h-16 border-4 border-sky-400 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      </div>
    )
  }

  // Error state (but still show data if available from cache)
  if (error && !kioskSettings) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center max-w-2xl px-8">
          <h1
            className="text-red-400 font-bold mb-4"
            style={{ fontSize: 'var(--font-size-2xl)' }}
          >
            Unable to Load Menu
          </h1>
          <p
            className="text-slate-400"
            style={{ fontSize: 'var(--font-size-base)' }}
          >
            {error}
          </p>
          <p
            className="text-slate-500 mt-4"
            style={{ fontSize: 'var(--font-size-sm)' }}
          >
            Please check your internet connection and Sanity configuration.
          </p>
        </div>
      </div>
    )
  }

  // No active board configured
  if (!kioskSettings?.activeBoard) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center max-w-2xl px-8">
          <h1
            className="text-amber-400 font-bold mb-4"
            style={{ fontSize: 'var(--font-size-2xl)' }}
          >
            No Active Menu
          </h1>
          <p
            className="text-slate-400"
            style={{ fontSize: 'var(--font-size-base)' }}
          >
            Please configure an active menu board in Sanity Studio.
          </p>
        </div>
      </div>
    )
  }

  // Wrap in ScreenProvider for secondary screen support
  return (
    <ScreenProvider
      secondaryScreens={secondaryScreens}
      defaultTimeoutSeconds={kioskSettings.defaultTimeoutSeconds ?? 30}
      initialActiveScreen={kioskSettings.activeSecondaryScreen ?? null}
    >
      <ScreenRenderer
        board={kioskSettings.activeBoard}
        announcementBar={kioskSettings.announcementBar}
        ignoreStockLevels={kioskSettings.ignoreStockLevels}
      />
    </ScreenProvider>
  )
}

/**
 * Inner component that handles screen mode switching with smooth transitions.
 * Must be inside ScreenProvider to access context.
 */
function ScreenRenderer({
  board,
  announcementBar,
  ignoreStockLevels,
}: {
  board: MenuBoard
  announcementBar?: string
  ignoreStockLevels?: boolean
}) {
  const { mode, activeScreen } = useScreenContext()

  // Set up keyboard controls
  useKeyboardControls()

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
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

export default App
