import { MenuItem } from './MenuItem'
import { ModifierGroup } from './ModifierGroup'
import type { MenuSection } from '../types'

interface CategoryColumnProps {
  section: MenuSection
  ignoreStockLevels?: boolean
}

export function CategoryColumn({ section, ignoreStockLevels }: CategoryColumnProps) {
  const { heading, items, modifiers } = section

  // Safety check: ensure items is an array
  const safeItems = items || []
  const safeModifiers = modifiers || []

  return (
    <div className="flex flex-col">
      {/* Section Heading */}
      <h2
        className="mb-4"
        style={{
          fontSize: '2vw',
          color: '#ff4d9f',
          fontWeight: '700',
          letterSpacing: '0.12em',
          textTransform: 'uppercase'
        }}
      >
        {heading}
      </h2>

      {/* Items List */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.15rem'
        }}
      >
        {safeItems.map((item) => (
          <MenuItem key={item._id} item={item} ignoreStockLevels={ignoreStockLevels} />
        ))}
      </div>

      {/* Empty state */}
      {safeItems.length === 0 && (
        <p
          style={{
            fontSize: '1.4vw',
            color: '#666666',
            fontStyle: 'italic',
            textTransform: 'uppercase'
          }}
        >
          No items available
        </p>
      )}

      {/* Modifiers Section */}
      {safeModifiers.length > 0 && (
        <div
          style={{
            marginTop: '2rem',
            breakInside: 'auto',
            breakBefore: 'auto',
          }}
        >
          {safeModifiers.map((modifier) => (
            <ModifierGroup key={modifier._id} modifier={modifier} />
          ))}
        </div>
      )}
    </div>
  )
}
