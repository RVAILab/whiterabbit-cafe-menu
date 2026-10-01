import type { ProjectedMenuItemV1 } from '../lib/projectedMenu'
import { toMenuItem } from '../lib/projectedMenu'
import { isMenuItemAvailable, isSoldOut } from '../lib/stock'
import type { StockStatus } from '../types'

const formatPrice = (price: number) => price.toFixed(2)

// Same treatment as the standard board's MenuItem / MenuItemGroup.
const SoldOutBadge = () => <span className="rh-sold-out">SOLD OUT</span>

function variantProps(stockStatus: StockStatus) {
  return isSoldOut(stockStatus)
    ? { className: 'opacity-40', style: { textDecoration: 'line-through' } }
    : {}
}

/**
 * One menu item on a plate. 1 variant: name and price on one row; 2–3: name,
 * then a gold sub-line; 4+: the group name, then a compact variant grid.
 */
export function RabbitHoleItem({ item }: { item: ProjectedMenuItemV1 }) {
  const menuItem = toMenuItem(item)
  const available = menuItem._type === 'menuItem'
    ? isMenuItemAvailable(menuItem)
    : !isSoldOut(menuItem.stockStatus)
  const variants = item.variants

  return (
    <div className={available ? 'rh-item' : 'rh-item opacity-40'} data-rh-item="">
      <div className="rh-item-row">
        <span>
          <span>{item.name}</span>
          {!available && <SoldOutBadge />}
        </span>
        {variants.length <= 1 && <b className="rh-price">{formatPrice(item.basePrice)}</b>}
      </div>

      {variants.length > 1 && variants.length <= 3 && (
        <small className="rh-subline" data-rh-subline="">
          {variants.map((variant, index) => (
            <span key={variant.id} {...variantProps(variant.stockStatus)}>
              {index > 0 && ' · '}
              {variant.label} {formatPrice(variant.price)}
              {isSoldOut(variant.stockStatus) && ' SOLD OUT'}
            </span>
          ))}
        </small>
      )}

      {variants.length > 3 && (
        <div className="rh-variant-grid" data-rh-variant-grid="">
          {variants.map((variant) => (
            <span key={variant.id} {...variantProps(variant.stockStatus)}>
              <span>{variant.label}</span>
              <b>
                {formatPrice(variant.price)}
                {isSoldOut(variant.stockStatus) && ' SOLD OUT'}
              </b>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
