import { MenuItem } from './MenuItem'
import { MenuItemGroup } from './MenuItemGroup'
import { ModifierGroup } from './ModifierGroup'
import { ToastieCallout } from './ToastieCallout'
import type { MenuSection, MenuSectionItem, MenuItem as MenuItemType } from '../types'

interface CategoryColumnProps {
  section: MenuSection
  ignoreStockLevels?: boolean
}

const TOASTIE_MODIFIER_TITLE = 'Trick Out Your Toastie'
const TOASTIE_ITEM_ID = 'product-odoo-222'

export function CategoryColumn({ section, ignoreStockLevels }: CategoryColumnProps) {
  const { heading, items, modifiers } = section

  // Safety check: ensure items is an array
  const safeItems = items || []
  const safeModifiers = modifiers || []

  // Check for toastie callout: a modifier matching the toastie title
  const toastieModifier = safeModifiers.find(m => m.title === TOASTIE_MODIFIER_TITLE)
  const toastieItem = toastieModifier
    ? safeItems.find(item => item._id === TOASTIE_ITEM_ID && item._type === 'menuItem') as MenuItemType | undefined
    : undefined

  // Filter out the toastie from regular items if we're rendering it as a callout
  const regularItems = toastieItem
    ? safeItems.filter(item => item._id !== TOASTIE_ITEM_ID)
    : safeItems

  // Regular modifiers (exclude the toastie one if it's rendered as callout)
  const regularModifiers = toastieModifier
    ? safeModifiers.filter(m => m.title !== TOASTIE_MODIFIER_TITLE)
    : safeModifiers

  return (
    <div className="flex flex-col">
      {/* Section Heading */}
      <h2
        className="mb-4"
        style={{
          fontSize: '1.04vw',
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
        {regularItems.map((item: MenuSectionItem) => {
          if (item._type === 'menuItemGroup') {
            return <MenuItemGroup key={item._id} item={item} />
          }
          return (
            <MenuItem
              key={item._id}
              item={item}
              ignoreStockLevels={ignoreStockLevels}
            />
          )
        })}
      </div>

      {/* Empty state */}
      {safeItems.length === 0 && (
        <p
          style={{
            fontSize: '1.12vw',
            color: '#666666',
            fontStyle: 'italic',
            textTransform: 'uppercase'
          }}
        >
          No items available
        </p>
      )}

      {/* Regular Modifiers */}
      {regularModifiers.length > 0 && (
        <div
          style={{
            marginTop: '1rem',
            breakInside: 'auto',
            breakBefore: 'auto',
          }}
        >
          {regularModifiers.map((modifier) => (
            <ModifierGroup key={modifier._id} modifier={modifier} />
          ))}
        </div>
      )}

      {/* Toastie Callout */}
      {toastieItem && toastieModifier && (
        <ToastieCallout item={toastieItem} modifier={toastieModifier} />
      )}
    </div>
  )
}
