import { MetaCategoryGroup } from './MetaCategoryGroup'
import type { MenuBoard } from '../types'

interface BoardLayoutProps {
  board: MenuBoard
  announcementBar?: string
  ignoreStockLevels?: boolean
}

export function BoardLayout({ board, announcementBar, ignoreStockLevels }: BoardLayoutProps) {
  const { title, sections } = board
  const drinkMeColumns = board.drinkMeColumns ?? 2
  const eatMeColumns = 4 - drinkMeColumns

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
    <div className="w-full h-full flex flex-col relative" style={{ padding: '10px' }}>
      {/* Announcement Bar */}
      {announcementBar && (
        <div className="w-full py-3 px-8" style={{ backgroundColor: '#fbbf24' }}>
          <div className="text-center">
            <span
              style={{
                fontSize: '1.2vw',
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
            gridTemplateColumns: `${drinkMeColumns}fr ${eatMeColumns}fr`,
            gap: '4rem',
            height: '100%'
          }}
        >
          {/* Left Side: DRINK ME */}
          <MetaCategoryGroup
            metaCategory="drink-me"
            sections={safeSections}
            ignoreStockLevels={ignoreStockLevels}
            columnCount={drinkMeColumns}
          />

          {/* Right Side: EAT ME */}
          <MetaCategoryGroup
            metaCategory="eat-me"
            sections={safeSections}
            ignoreStockLevels={ignoreStockLevels}
            columnCount={eatMeColumns}
          />
        </div>
      </main>

      {/* Member Discount Note */}
      <div
        style={{
          position: 'absolute',
          right: '16px',
          bottom: '160px',
          fontSize: '0.88vw',
          color: 'rgba(255, 255, 255, 0.7)',
          fontWeight: '300',
          letterSpacing: '0.08em',
        }}
      >
        Members receive 15% discount
      </div>
    </div>
  )
}
