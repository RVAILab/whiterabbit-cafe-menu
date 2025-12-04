import { useMenuData } from './hooks/useMenuData'
import { BoardLayout } from './components/BoardLayout'

function App() {
  const { kioskSettings, isLoading, error } = useMenuData()

  // Debug logging
  console.log('🔍 App render:', {
    isLoading,
    hasKioskSettings: !!kioskSettings,
    hasActiveBoard: !!kioskSettings?.activeBoard,
    sectionsCount: kioskSettings?.activeBoard?.sections?.length,
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

  // Display the menu board
  return (
    <BoardLayout
      board={kioskSettings.activeBoard}
      announcementBar={kioskSettings.announcementBar}
      ignoreStockLevels={kioskSettings.ignoreStockLevels}
    />
  )
}

export default App
