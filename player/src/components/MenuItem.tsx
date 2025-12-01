import type { MenuItem as MenuItemType } from '../types'

interface MenuItemProps {
  item: MenuItemType
  ignoreStockLevels?: boolean
}

export function MenuItem({ item, ignoreStockLevels = false }: MenuItemProps) {
  const { title, price, isAvailable, availabilityOverride, dietaryTags, marketingDescription } = item

  // Format price to always show 2 decimal places
  const formattedPrice = `$${price.toFixed(2)}`

  // Calculate final availability using priority logic
  const calculateAvailability = (): boolean => {
    // Priority 1: Per-item override
    if (availabilityOverride && availabilityOverride !== 'use-inventory') {
      return availabilityOverride === 'always-available'
    }

    // Priority 2: Global ignore stock levels
    if (ignoreStockLevels) {
      return true
    }

    // Priority 3: Use actual inventory status
    return isAvailable
  }

  const finalIsAvailable = calculateAvailability()

  return (
    <div
      className={!finalIsAvailable ? 'opacity-40' : ''}
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: '1rem',
        alignItems: 'start',
        marginBottom: '0.55rem'
      }}
    >
      {/* Left side: Item name and description */}
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
          {/* Spicy indicator */}
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

          {/* Sold Out Badge */}
          {!finalIsAvailable && (
            <span
              style={{
                fontSize: '1.2vw',
                color: '#fbbf24',
                fontWeight: '400',
                letterSpacing: '0.05em',
                flexShrink: 0,
                textTransform: 'uppercase'
              }}
            >
              SOLD OUT
            </span>
          )}
        </div>

        {/* Description */}
        {marketingDescription && (
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
            {marketingDescription}
          </div>
        )}
      </div>

      {/* Right side: Price */}
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
        {formattedPrice}
      </span>
    </div>
  )
}
