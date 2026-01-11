import { MetaCategoryGroup } from './MetaCategoryGroup'
import type { MenuBoard } from '../types'

interface BoardLayoutProps {
  board: MenuBoard
  announcementBar?: string
  ignoreStockLevels?: boolean
}

export function BoardLayout({ board, announcementBar, ignoreStockLevels }: BoardLayoutProps) {
  const { title, sections } = board

  // Safety check: ensure sections is an array
  const safeSections = sections || []

  // Debug logging
  console.log('🎨 BoardLayout render:', {
    title,
    sectionsCount: safeSections.length,
    sections: safeSections.map(s => ({ heading: s.heading, metaCategory: s.metaCategory, itemCount: s.items?.length })),
    ignoreStockLevels
  })

  return (
    <div className="w-full h-full flex flex-col" style={{ padding: '10px' }}>
      {/* Announcement Bar */}
      {announcementBar && (
        <div className="w-full py-3 px-8" style={{ backgroundColor: '#fbbf24' }}>
          <div className="text-center">
            <span
              style={{
                fontSize: '1.5vw',
                color: '#0a0a0a',
                fontWeight: '300',
                letterSpacing: '0.12em',
                textTransform: 'uppercase'
              }}
            >
              {announcementBar}
            </span>
          </div>
        </div>
      )}

      {/* Main Menu - Split Layout with Meta-Category Groups */}
      <main className="flex-1 px-16 pt-8 pb-4" style={{ overflow: 'hidden' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '3fr 1fr',
            gap: '4rem',
            height: '100%'
          }}
        >
          {/* Left Side: DRINK ME */}
          <MetaCategoryGroup
            metaCategory="drink-me"
            sections={safeSections}
            ignoreStockLevels={ignoreStockLevels}
            columnCount={3}
          />

          {/* Right Side: EAT ME */}
          <MetaCategoryGroup
            metaCategory="eat-me"
            sections={safeSections}
            ignoreStockLevels={ignoreStockLevels}
            columnCount={1}
          />
        </div>
      </main>
    </div>
  )
}
