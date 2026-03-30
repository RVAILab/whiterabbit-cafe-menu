import type { MenuItem as MenuItemType, DietaryTag } from '../types'

// Fallback dietary tags until Sanity schema supports writing them
const DIETARY_TAG_OVERRIDES: Record<string, DietaryTag[]> = {
  'product-odoo-669': ['GF'],          // Pistachio Brownie
  'product-odoo-670': ['GF'],          // Cinnamon Roll
  'product-odoo-672': ['GF'],          // Caramel Coffee Muffin
  'product-odoo-671': ['GF'],          // Lime Coconut Muffin
  'product-odoo-506': ['V'],           // Farmhouse Miso Soup
  'product-odoo-574': ['VE', 'GF'],    // Silken Carrot Soup
  'product-odoo-552': ['GF'],          // Bone Broth
  'product-odoo-451': ['GF'],          // Blueberry Tarragon Chicken Salad
  'product-odoo-595': ['V', 'GF'],     // Emerald Nest
  'product-odoo-584': ['V', 'GF'],     // Floral Beet Salad
  'product-odoo-440': ['V', 'GF'],     // Kale Salad
  'product-odoo-624': ['V'],           // Morningstar Egg Sandwich
  'product-odoo-591': ['V', 'N'],      // Toasted Organic PB&J
  'product-odoo-516': ['V'],           // Sourdough Toastie
  'product-odoo-548': ['V', 'N'],      // Organic PB&J
}

interface MenuItemProps {
  item: MenuItemType
  ignoreStockLevels?: boolean
}

export function MenuItem({ item, ignoreStockLevels = false }: MenuItemProps) {
  const { title, price, isAvailable, availabilityOverride, dietaryTags: rawDietaryTags, marketingDescription } = item

  // Use Sanity tags if present, otherwise fall back to overrides
  const dietaryTags = (rawDietaryTags && rawDietaryTags.length > 0)
    ? rawDietaryTags
    : DIETARY_TAG_OVERRIDES[item._id] || null

  // Format price - show "Gratis" for free items
  const formattedPrice = price === 0 ? 'Gratis' : price.toFixed(2)

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
            <span style={{ fontSize: '0.96vw', flexShrink: 0 }}>🌶️</span>
          )}

          <span
            style={{
              fontSize: '1.04vw',
              fontWeight: '700',
              letterSpacing: '0.08em',
              color: '#ffffff',
              textTransform: 'uppercase'
            }}
          >
            {title}
            {/* Dietary Tags - inline with title */}
            {dietaryTags && dietaryTags.filter(t => t !== 'ALC').length > 0 && (
              <span
                style={{
                  fontSize: '0.72vw',
                  color: '#a8ff70',
                  fontWeight: '700',
                  letterSpacing: '0.05em',
                  marginLeft: '0.15rem',
                }}
              >
                {dietaryTags.filter(t => t !== 'ALC').join(' · ')}
              </span>
            )}
          </span>

          {/* Sold Out Badge */}
          {!finalIsAvailable && (
            <span
              style={{
                fontSize: '0.96vw',
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
              fontSize: '0.83vw',
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
          fontSize: '1.2vw',
          color: '#7ed957',
          fontWeight: '400',
          whiteSpace: 'nowrap',
          textTransform: 'uppercase'
        }}
      >
        {formattedPrice}
      </span>
    </div>
  )
}
