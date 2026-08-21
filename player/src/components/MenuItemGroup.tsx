import type { MenuItemGroup as MenuItemGroupType } from '../types'

interface MenuItemGroupProps {
  item: MenuItemGroupType
}

export function MenuItemGroup({ item }: MenuItemGroupProps) {
  const { title, itemNames, priceRange, dietaryTags, stockStatus, variants } = item

  const isSinglePrice = priceRange.minPrice === priceRange.maxPrice
  const isSoldOut = stockStatus === 'sold-out'

  return (
    <div
      className={isSoldOut ? 'opacity-40' : ''}
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
            <span style={{ fontSize: '1.2vw', flexShrink: 0 }}>🌶️</span>
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
          </span>
          {isSoldOut && (
            <span
              style={{
                fontSize: '0.96vw',
                color: '#fbbf24',
                fontWeight: '400',
                letterSpacing: '0.05em',
                flexShrink: 0,
                textTransform: 'uppercase',
              }}
            >
              SOLD OUT
            </span>
          )}
        </div>

        {/* Item names displayed where description would be */}
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
          {variants
            ? variants.map((variant, index) => (
                <span
                  key={variant.id}
                  className={variant.stockStatus === 'sold-out' ? 'opacity-40' : ''}
                  style={variant.stockStatus === 'sold-out' ? { textDecoration: 'line-through' } : undefined}
                >
                  {index > 0 && ' · '}
                  {variant.label} {variant.price === 0 ? 'Gratis' : variant.price.toFixed(2)}
                  {variant.stockStatus === 'sold-out' && ' SOLD OUT'}
                </span>
              ))
            : itemNames}
        </div>
      </div>

      {/* Right side: Price range - stacked vertically if range, single line if same */}
      {!variants && <div
        className="tabular-nums"
        style={{
          fontSize: '1.2vw',
          color: '#7ed957',
          fontWeight: '400',
          textAlign: 'right',
          textTransform: 'uppercase',
          lineHeight: '1.1'
        }}
      >
        {isSinglePrice ? (
          <span>{priceRange.minPrice === 0 ? 'Gratis' : priceRange.minPrice.toFixed(2)}</span>
        ) : (
          <>
            <div>{priceRange.minPrice === 0 ? 'Gratis' : priceRange.minPrice.toFixed(2)}-</div>
            <div>{priceRange.maxPrice === 0 ? 'Gratis' : priceRange.maxPrice.toFixed(2)}{'\u00A0'}</div>
          </>
        )}
      </div>}
    </div>
  )
}
