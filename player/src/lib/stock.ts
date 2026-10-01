import type { MenuItem, StockStatus } from '../types'

export const isSoldOut = (stockStatus: StockStatus | undefined) => stockStatus === 'sold-out'

/** Whether a menu item shows as orderable, by the wall menu's priority rules. */
export function isMenuItemAvailable(item: MenuItem, ignoreStockLevels = false): boolean {
  const { isAvailable, stockStatus, availabilityOverride } = item

  // Projected stock is an explicit Odoo/POS verdict and must be reflected as-is.
  if (stockStatus) return !isSoldOut(stockStatus)

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
