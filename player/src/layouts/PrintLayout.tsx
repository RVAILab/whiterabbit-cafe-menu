import type { MenuBoard, MenuSection, MenuSectionItem, MenuModifier, MenuItem as MenuItemType, DietaryTag } from '../types'

function getDietaryTags(item: MenuSectionItem): DietaryTag[] {
  if (item._type !== 'menuItem') return []
  return (item.dietaryTags || []).filter(t => t !== 'ALC')
}

interface PrintLayoutProps {
  board: MenuBoard
  announcementBar?: string
  ignoreStockLevels?: boolean
}

/**
 * Print layout - designed for 11"x17" tabloid landscape printing.
 * Four-column layout: Brand | Drink Me | Eat Me | Grab & Go
 */
export function PrintLayout({
  board,
  ignoreStockLevels,
}: PrintLayoutProps) {
  const { sections } = board
  const safeSections = sections || []

  const drinkSections = safeSections.filter(s => s.metaCategory === 'drink-me')
  const eatSections = safeSections.filter(s => s.metaCategory === 'eat-me')

  return (
    <div className="print-page">
      <main className="print-body">
        {/* Column 1: Brand */}
        <div className="print-column print-column-brand">
          <div className="print-brand-top">
            <img
              src="/logo-white.png"
              alt="White Rabbit"
              className="print-logo"
            />
            <p className="print-tagline">Farm-to-function cafe</p>
            <PrintCallout />
          </div>
          <div className="print-brand-bottom">
            <div className="print-hours">
              <p className="print-hours-line">Mon–Fri &nbsp; 9am–5pm</p>
              <p className="print-hours-line">Sat &nbsp; 9am–5pm</p>
            </div>
          </div>
        </div>

        {/* Columns 2-4: Menu area */}
        <div className="print-menu-area">
          <div className="print-menu-columns">
            {/* Column 2: Drink Me */}
            <div className="print-column print-column-drink">
              <h2 className="print-meta-header">Drink Me</h2>
              <div className="print-sections">
                {drinkSections.map((section, i) => (
                  <PrintSection key={`drink-${i}`} section={section} ignoreStockLevels={ignoreStockLevels} />
                ))}
              </div>
            </div>

            {/* Column 3: Eat Me */}
            <div className="print-column print-column-eat">
              <h2 className="print-meta-header">Eat Me</h2>
              <div className="print-sections">
                {eatSections.map((section, i) => (
                  <PrintSection key={`eat-${i}`} section={section} ignoreStockLevels={ignoreStockLevels} />
                ))}
              </div>
            </div>

            {/* Column 4: Grab & Go (hardcoded) */}
            <div className="print-column print-column-other">
              <h2 className="print-meta-header">Grab &amp; Go</h2>
              <div className="print-sections">
                <PrintStaticSection heading="Fresh Baked — Vida Bakery" items={[
                  { name: 'Pistachio Brownie', price: '5.25', tags: 'GF' },
                  { name: 'Cinnamon Roll', price: '4.75', tags: 'GF' },
                  { name: 'Caramel Coffee Muffin', price: '4.75', tags: 'GF' },
                  { name: 'Lime Coconut Muffin', price: '4.50', tags: 'GF' },
                ]} />
                <PrintStaticSection heading="Savory Snacks" items={[
                  { name: 'Joon Pistachios', price: '8.00' },
                  { name: 'Popadelics Mushroom Chips', price: '6.00' },
                  { name: 'Siete Nacho Tortilla Chips', price: '6.00' },
                  { name: "Pan's Mushroom Jerky", price: '4.00–8.00' },
                  { name: 'Stellar Pretzel Braids', price: '4.00–6.00' },
                  { name: 'New Primal Spicy Beef Stick', price: '3.00' },
                  { name: 'Raw Almonds, Cashews', price: '2.75' },
                  { name: 'New Primal Chicken Stick', price: '2.50' },
                  { name: 'Gimme Nori', price: '2.00' },
                ]} />
                <PrintStaticSection heading="Sweet Snacks" items={[
                  { name: 'Raaka Chocolates', price: '5.00–8.00' },
                  { name: 'Date Better', price: '7.00' },
                  { name: 'RIND Dried Fruit', price: '6.50' },
                  { name: 'TRUBAR', price: '2.95' },
                ]} />
                <PrintStaticSection heading="Cold Drinks" items={[
                  { name: 'Mountain Valley Spring Water', price: '7.00' },
                  { name: 'Fermensch Apple Chai', price: '6.00' },
                  { name: 'Fermensch Bloom', price: '6.00' },
                  { name: 'Fermensch Dry-Hopped Pear', price: '6.00' },
                  { name: 'Strange Water Coconut', price: '5.00' },
                  { name: 'Poppi', price: '3.50' },
                  { name: 'Noble Tonic', price: '3.50' },
                  { name: 'Drink Sound', price: '3.50' },
                  { name: 'DRAM Sparkling Waters', price: '3.00' },
                ]} />
              </div>
            </div>
          </div>

          {/* Dietary tags footer spanning all menu columns */}
          <div className="print-dietary-footer">
            <span><strong>VE</strong> Vegan</span>
            <span><strong>V</strong> Vegetarian</span>
            <span><strong>GF</strong> Gluten Free</span>
            <span><strong>N</strong> Contains Nuts</span>
          </div>
        </div>
      </main>
    </div>
  )
}

/* ---- Sub-components ---- */

function PrintSection({
  section,
  ignoreStockLevels,
}: {
  section: MenuSection
  ignoreStockLevels?: boolean
}) {
  const { heading, items, modifiers } = section
  const safeItems = items || []
  const safeModifiers = modifiers || []

  const toastieModifier = safeModifiers.find(m => m.title === 'Trick Out Your Toastie')
  const toastieItem = toastieModifier
    ? safeItems.find(item => item._id === 'product-odoo-516' && item._type === 'menuItem')
    : undefined

  const regularItems = toastieItem
    ? safeItems.filter(item => item._id !== 'product-odoo-516')
    : safeItems
  const regularModifiers = toastieModifier
    ? safeModifiers.filter(m => m.title !== 'Trick Out Your Toastie')
    : safeModifiers

  return (
    <div className="print-section">
      <h3 className="print-section-header">{heading}</h3>
      <div className="print-items">
        {regularItems.map((item) => (
          <PrintItem key={item._id} item={item} ignoreStockLevels={ignoreStockLevels} />
        ))}
      </div>
      {regularModifiers.length > 0 && (
        <div className="print-modifiers">
          {regularModifiers.map((mod) => (
            <PrintModifier key={mod._id} modifier={mod} />
          ))}
        </div>
      )}
      {toastieItem && toastieItem._type === 'menuItem' && toastieModifier && (
        <PrintToastieCallout item={toastieItem} modifier={toastieModifier} />
      )}
    </div>
  )
}

function PrintItem({
  item,
  ignoreStockLevels,
}: {
  item: MenuSectionItem
  ignoreStockLevels?: boolean
}) {
  if (item._type === 'menuItemGroup') {
    const { title, priceRange } = item
    const isSinglePrice = priceRange.minPrice === priceRange.maxPrice
    const priceStr = isSinglePrice
      ? formatPrice(priceRange.minPrice)
      : `${formatPrice(priceRange.minPrice)}–${formatPrice(priceRange.maxPrice)}`

    return (
      <div className="print-item">
        <span className="print-item-name">{title}</span>
        <span className="print-item-price">{priceStr}</span>
      </div>
    )
  }

  const { title, price, isAvailable, availabilityOverride } = item

  const finalAvailable = (() => {
    if (availabilityOverride && availabilityOverride !== 'use-inventory') {
      return availabilityOverride === 'always-available'
    }
    if (ignoreStockLevels) return true
    return isAvailable
  })()

  const tags = getDietaryTags(item)

  return (
    <div className={`print-item${!finalAvailable ? ' print-item-unavailable' : ''}`}>
      <span className="print-item-name">
        {title}
        {tags.length > 0 && (
          <span className="print-dietary-tag"> {tags.join(' · ')}</span>
        )}
      </span>
      <span className="print-item-price">{formatPrice(price)}</span>
    </div>
  )
}

function PrintModifier({ modifier }: { modifier: MenuModifier }) {
  const { title, displayStyle, globalPrice, options } = modifier

  if (displayStyle === 'inline') {
    return (
      <div className="print-modifier">
        <span className="print-section-header">{title}: </span>
        <span className="print-modifier-options">
          {options.map(o => o.name).join(' · ')}
        </span>
        {globalPrice != null && globalPrice > 0 && (
          <span className="print-modifier-price"> +{globalPrice.toFixed(2)}</span>
        )}
      </div>
    )
  }

  return (
    <div className="print-modifier">
      <h4 className="print-section-header">{title}</h4>
      {options.map((option, i) => (
        <div key={i} className="print-item">
          <span className="print-modifier-option-name">{option.name}</span>
          {option.price != null && option.price > 0 && (
            <span className="print-modifier-price">+{option.price.toFixed(2)}</span>
          )}
        </div>
      ))}
    </div>
  )
}

function PrintStaticSection({ heading, items }: {
  heading: string
  items: { name: string; price: string; desc?: string; tags?: string }[]
}) {
  return (
    <div className="print-section">
      <h3 className="print-section-header">{heading}</h3>
      <div className="print-items">
        {items.map((item, i) => (
          <div key={i}>
            <div className="print-item">
              <span className="print-item-name">
                {item.name}
                {item.tags && <span className="print-dietary-tag"> {item.tags}</span>}
              </span>
              <span className="print-item-price">{item.price}</span>
            </div>
            {item.desc && (
              <div className="print-item-desc">{item.desc}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function PrintToastieCallout({ item, modifier }: { item: MenuItemType; modifier: MenuModifier }) {
  return (
    <div className="print-toastie-callout">
      <div className="print-toastie-header">
        <span className="print-toastie-name">{item.title}<span className="print-dietary-tag"> V</span></span>
        <span className="print-toastie-price">{item.price.toFixed(2)}</span>
      </div>
      {item.marketingDescription && (
        <div className="print-toastie-desc">{item.marketingDescription}</div>
      )}
      <div className="print-toastie-modifier-title">{modifier.title}</div>
      <div className="print-toastie-options">
        {modifier.options.map((opt, i) => (
          <div key={i} className="print-toastie-option">
            <span>{opt.name}</span>
            {opt.price != null && opt.price > 0 && (
              <span>+{opt.price.toFixed(2)}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function PrintCallout() {
  return (
    <div className="print-callout">
      <p className="print-callout-text">
        Everything here is designed to make you feel as good as it tastes.
        Developed with a functional nutritionist around sustained energy, focus,
        and gut-brain connection. Locally sourced, low sugar, high intention.
      </p>
    </div>
  )
}

function formatPrice(price: number): string {
  if (price === 0) return 'Gratis'
  return price.toFixed(2)
}
