import type { MenuItemGroup as MenuItemGroupType } from '../types'

interface MenuItemGroupProps {
  item: MenuItemGroupType
}

export function MenuItemGroup({ item }: MenuItemGroupProps) {
  const { title, itemNames, priceRange, dietaryTags } = item

  // Format price range - show single price if min === max
  const priceDisplay = priceRange.minPrice === priceRange.maxPrice
    ? `$${priceRange.minPrice.toFixed(2)}`
    : `$${priceRange.minPrice.toFixed(2)}-$${priceRange.maxPrice.toFixed(2)}`

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: '1rem',
        alignItems: 'start',
        marginBottom: '0.55rem'
      }}
    >
      {/* Left side: Title and item names */}
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
          {/* Spicy indicator for alcoholic items */}
          {dietaryTags?.includes('ALC') && (
            <span style={{ fontSize: '1.5vw', flexShrink: 0 }}>🌶️</span>
          )}

          <span
            style={{
              fontSize: '1.3vw',
              fontWeight: '700',
              letterSpacing: '0.08em',
              color: '#ffffff',
              textTransform: 'uppercase'
            }}
          >
            {title}
          </span>
        </div>

        {/* Item names displayed where description would be */}
        <div
          className="mt-0.5"
          style={{
            fontSize: '1.3vw',
            color: '#ffffff',
            fontWeight: '300',
            letterSpacing: '0.05em',
            textTransform: 'uppercase'
          }}
        >
          {itemNames}
        </div>
      </div>

      {/* Right side: Price range */}
      <span
        className="tabular-nums"
        style={{
          fontSize: '1.5vw',
          color: '#7ed957',
          fontWeight: '700',
          whiteSpace: 'nowrap',
          textTransform: 'uppercase'
        }}
      >
        {priceDisplay}
      </span>
    </div>
  )
}
