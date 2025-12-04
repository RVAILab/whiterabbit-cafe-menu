import { CategoryColumn } from './CategoryColumn'
import type { MenuSection, MetaCategory } from '../types'

interface MetaCategoryGroupProps {
  metaCategory: MetaCategory
  sections: MenuSection[]
  ignoreStockLevels?: boolean
  columnCount?: number
}

const META_CATEGORY_LABELS: Record<MetaCategory, string> = {
  'drink-me': 'DRINK ME',
  'eat-me': 'EAT ME'
}

export function MetaCategoryGroup({
  metaCategory,
  sections,
  ignoreStockLevels,
  columnCount = 2
}: MetaCategoryGroupProps) {
  // Filter sections by meta-category
  const filteredSections = sections.filter(
    section => section.metaCategory === metaCategory
  )

  // Debug logging
  console.log(`🔖 MetaCategoryGroup [${metaCategory}]:`, {
    totalSections: sections.length,
    filteredSections: filteredSections.length,
    sections: filteredSections.map(s => ({ heading: s.heading, itemCount: s.items?.length }))
  })

  // Empty state
  if (filteredSections.length === 0) {
    return (
      <div className="flex flex-col" style={{ height: '100%' }}>
        <h2
          className="mb-6"
          style={{
            fontFamily: 'PP Pangram Sans Rounded',
            fontSize: '5vw',
            fontWeight: '100',
            letterSpacing: '0.15em',
            color: '#fbbf24',
            textTransform: 'uppercase',
            textAlign: 'left'
          }}
        >
          {META_CATEGORY_LABELS[metaCategory]}
        </h2>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1,
            color: '#666666',
            fontSize: '1.8vw',
            fontStyle: 'italic',
            textTransform: 'uppercase'
          }}
        >
          No sections configured
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col" style={{ height: '100%' }}>
      {/* Meta-Category Header */}
      <h2
        className="mb-6"
        style={{
          fontFamily: 'PP Pangram Sans Rounded',
          fontSize: '5vw',
          fontWeight: '100',
          letterSpacing: '0.15em',
          color: '#fbbf24',
          textTransform: 'uppercase',
          textAlign: 'left'
        }}
      >
        {META_CATEGORY_LABELS[metaCategory]}
      </h2>

      {/* Multi-Column Layout for Sections */}
      <div
        style={{
          columnCount: columnCount,
          columnGap: '2rem',
          flex: 1,
          overflow: 'visible'
        }}
      >
        {filteredSections.map((section, index) => (
          <div
            key={`${section.heading}-${index}`}
            style={{
              breakInside: 'avoid-column',
              marginBottom: '2rem'
            }}
          >
            <CategoryColumn
              section={section}
              ignoreStockLevels={ignoreStockLevels}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
