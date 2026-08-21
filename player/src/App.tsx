import { Routes, Route } from 'react-router-dom'
import { useProjectedMenu } from './hooks/useProjectedMenu'
import { ScreenProvider } from './context/ScreenContext'
import { VisualizationProvider } from './context/VisualizationContext'
import { SleepModeProvider } from './context/SleepModeContext'
import { ProjectorLayout } from './layouts/ProjectorLayout'
import { CustomerLayout } from './layouts/CustomerLayout'
import { PrintLayout } from './layouts/PrintLayout'
import { toProjectedMenuSections } from './lib/projectedMenu'
import type { MenuBoard } from './types'

const SECONDARY_SCREENS: [] = []
const DEFAULT_SECONDARY_SCREEN_TIMEOUT_SECONDS = 30

function toMenuBoard(document: NonNullable<ReturnType<typeof useProjectedMenu>['document']>): MenuBoard {
  return {
    title: 'White Rabbit Cafe Menu',
    slug: { current: 'white-rabbit-cafe-menu' },
    sections: toProjectedMenuSections(document),
  }
}

function App() {
  const projectedMenu = useProjectedMenu()
  const board = projectedMenu.document ? toMenuBoard(projectedMenu.document) : null

  // Loading state
  if (projectedMenu.isLoading && !board) {
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
  if (projectedMenu.error && !board) {
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
            {projectedMenu.error}
          </p>
          <p
            className="text-slate-500 mt-4"
            style={{ fontSize: 'var(--font-size-sm)' }}
          >
            Check the menu service and this display's network connection. The
            player will retry automatically.
          </p>
        </div>
      </div>
    )
  }

  if (!board) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center max-w-2xl px-8">
          <h1
            className="text-amber-400 font-bold mb-4"
            style={{ fontSize: 'var(--font-size-2xl)' }}
          >
            Menu Unavailable
          </h1>
          <p
            className="text-slate-400"
            style={{ fontSize: 'var(--font-size-base)' }}
          >
            No valid menu document is available yet. Check the menu service and
            this display's network connection.
          </p>
        </div>
      </div>
    )
  }

  // Wrap in providers for secondary screen and visualization support
  // Routes determine which layout to render
  return (
    <SleepModeProvider>
    <VisualizationProvider>
      <ScreenProvider
        secondaryScreens={SECONDARY_SCREENS}
        defaultTimeoutSeconds={DEFAULT_SECONDARY_SCREEN_TIMEOUT_SECONDS}
      >
        <Routes>
          {/* Customer view - default route */}
          <Route
            path="/"
            element={
              <CustomerLayout
                board={board}
              />
            }
          />
          {/* Projector view - keyboard controlled */}
          <Route
            path="/projection"
            element={
              <ProjectorLayout
                board={board}
              />
            }
          />
          {/* Print view - 11x17 tabloid layout (dark) */}
          <Route
            path="/print"
            element={
              <PrintLayout
                board={board}
              />
            }
          />
          {/* Print view - light theme */}
          <Route
            path="/print-light"
            element={
              <PrintLayout
                board={board}
                theme="light"
              />
            }
          />
        </Routes>
      </ScreenProvider>
    </VisualizationProvider>
    </SleepModeProvider>
  )
}

export default App
