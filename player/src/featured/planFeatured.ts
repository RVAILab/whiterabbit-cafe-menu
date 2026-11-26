import type { ProjectedMenuDocumentV2, ProjectedMenuItemV1, ProjectedMenuItemV2 } from '../lib/projectedMenu'

/** One section on the featured wall: its pictured item (absent for later food sections) and the rest as lines. */
export interface FeaturedBlock {
  id: string
  label: string
  featured?: ProjectedMenuItemV2
  /** Lead block only: the next item, shown big (name, price, description) under the featured one. */
  runnerUp?: ProjectedMenuItemV2
  items: ProjectedMenuItemV2[]
}

export interface FeaturedPlan {
  /** drinks[0] is the big block on the left, drinks[1..4] the 2×2 grid. */
  drinks: FeaturedBlock[]
  /** The food capsule: food[0] is pictured, later sections are a label and a plain list. */
  food: FeaturedBlock[]
}

/** The lead block plus the 2×2 grid. */
const MAX_DRINK_BLOCKS = 5

function sectionsOn(document: ProjectedMenuDocumentV2, side: 'drink-me' | 'eat-me' | 'bar') {
  return document.sections
    .filter((section) => section.side === side && section.items.length > 0)
    .sort((left, right) => left.position - right.position)
}

function pictured(section: ProjectedMenuDocumentV2['sections'][number]): FeaturedBlock {
  const featured = section.items.find(({ id }) => id === section.featuredItemId) ?? section.items[0]
  return { id: section.id, label: section.name, featured, items: section.items.filter((item) => item !== featured) }
}

/**
 * Assign the v2 sections to the featured wall. Drink sections by position:
 * the first is the lead block, the next four the grid; bar sections follow the
 * café's drinks (a Bar menu is only bar sections). shortcut: drink sections past the fifth are dropped silently; give
 * the wall a sixth slot (or fall back) if the menu ever grows that far.
 */
export function planFeatured(document: ProjectedMenuDocumentV2): FeaturedPlan {
  const [firstFood, ...laterFood] = sectionsOn(document, 'eat-me')
  // Bar sections are drinks too, after the café's (a Bar menu has only them, so they lead).
  const drinkSections = [...sectionsOn(document, 'drink-me'), ...sectionsOn(document, 'bar')]
  const [lead, ...grid] = drinkSections.slice(0, MAX_DRINK_BLOCKS).map(pictured)
  // The lead block has room for a second big item beside its cup: the first in its list (set by order in Back office).
  const drinks = lead ? [{ ...lead, runnerUp: lead.items[0], items: lead.items.slice(1) }, ...grid] : []
  return {
    drinks,
    food: firstFood
      ? [pictured(firstFood), ...laterFood.map((s) => ({ id: s.id, label: s.name, items: s.items }))]
      : [],
  }
}

/** Whole numbers without decimals ("6"), else two decimals ("5.50"). */
export function formatPrice(price: number): string {
  return Number.isInteger(price) ? String(price) : price.toFixed(2)
}

const SIZE_LABEL = /\d+\s*oz/i

/** Sizes show every price ("4.75 / 5.50"), other choices "from <min>", a single variant its base price. */
export function itemPrice(item: ProjectedMenuItemV1): string {
  if (item.variants.length <= 1) return formatPrice(item.basePrice)
  const prices = item.variants.map(({ price }) => price)
  if (item.variants.every(({ label }) => SIZE_LABEL.test(label))) {
    return [...new Set(prices)].sort((a, b) => a - b).map(formatPrice).join(' / ')
  }
  return `from ${formatPrice(Math.min(...prices))}`
}
