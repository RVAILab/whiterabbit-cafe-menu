import type {
  MenuBoard,
  MenuItem,
  MenuItemGroup,
  MenuSection,
  MetaCategory,
  StockStatus,
} from '../types'

export const PROJECTED_MENU_SECTIONS = [
  { id: 'noble-coffee', name: 'Noble Coffee', metaCategory: 'drink-me' },
  { id: 'eat-me', name: 'Eat Me', metaCategory: 'eat-me' },
  { id: 'chocolates', name: 'Chocolates', metaCategory: 'drink-me' },
  { id: 'tea-time', name: 'Tea Time', metaCategory: 'drink-me' },
  { id: 'zi-spice-chai', name: 'Zi Spice Chai', metaCategory: 'drink-me' },
  { id: 'cold-drinks', name: 'Cold Drinks', metaCategory: 'drink-me' },
] as const satisfies ReadonlyArray<{
  id: string
  name: string
  metaCategory: MetaCategory
}>

export type ProjectedMenuSectionId = typeof PROJECTED_MENU_SECTIONS[number]['id']

export interface ProjectedMenuVariantV1 {
  id: string
  productId: number
  label: string
  price: number
  stockStatus: StockStatus
}

export interface ProjectedMenuItemV1 {
  id: string
  templateId: number
  name: string
  basePrice: number
  variants: ProjectedMenuVariantV1[]
  stockStatus: StockStatus
}

export interface ProjectedMenuSectionV1 {
  id: ProjectedMenuSectionId
  name: typeof PROJECTED_MENU_SECTIONS[number]['name']
  items: ProjectedMenuItemV1[]
}

export interface ProjectedMenuDocumentV1 {
  schemaVersion: 1
  generatedAt: string
  availabilityRevision: string
  sections: ProjectedMenuSectionV1[]
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0

const isPrice = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0

const isOdooId = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0

const isStockStatus = (value: unknown): value is StockStatus =>
  value === 'available' || value === 'sold-out' || value === 'untracked'

const isAvailabilityRevision = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value)

function isVariant(value: unknown): value is ProjectedMenuVariantV1 {
  return isRecord(value)
    && isNonEmptyString(value.id)
    && isOdooId(value.productId)
    && isNonEmptyString(value.label)
    && isPrice(value.price)
    && isStockStatus(value.stockStatus)
}

function isItem(value: unknown): value is ProjectedMenuItemV1 {
  return isRecord(value)
    && isNonEmptyString(value.id)
    && isOdooId(value.templateId)
    && isNonEmptyString(value.name)
    && isPrice(value.basePrice)
    && isStockStatus(value.stockStatus)
    && Array.isArray(value.variants)
    && value.variants.every(isVariant)
}

function isSection(value: unknown): value is ProjectedMenuSectionV1 {
  const configuredSection = isRecord(value)
    ? PROJECTED_MENU_SECTIONS.find(({ id }) => id === value.id)
    : undefined

  return isRecord(value)
    && configuredSection !== undefined
    && value.name === configuredSection.name
    && Array.isArray(value.items)
    && value.items.every(isItem)
}

function hasUniqueConfiguredSections(value: unknown[]): boolean {
  // Empty sections are deliberately omitted by the compiler. Ordering is
  // normalized below, but duplicates are ambiguous and must be rejected.
  const ids = value.map((section) => isRecord(section) ? section.id : null)
  return new Set(ids).size === ids.length
}

function hasAtLeastOneMenuItem(value: unknown[]): boolean {
  return value.some((section) => (
    isRecord(section)
    && Array.isArray(section.items)
    && section.items.length > 0
  ))
}

export function parseProjectedMenuDocument(value: unknown): ProjectedMenuDocumentV1 {
  if (
    !isRecord(value)
    || value.schemaVersion !== 1
    || !isNonEmptyString(value.generatedAt)
    || Number.isNaN(Date.parse(value.generatedAt))
    || !isAvailabilityRevision(value.availabilityRevision)
    || !Array.isArray(value.sections)
    || !value.sections.every(isSection)
    || !hasUniqueConfiguredSections(value.sections)
    || !hasAtLeastOneMenuItem(value.sections)
  ) {
    throw new Error('Projected menu response does not match schema version 1')
  }

  return value as unknown as ProjectedMenuDocumentV1
}

function toMenuItem(item: ProjectedMenuItemV1): MenuItem | MenuItemGroup {
  // Odoo emits the sole product variant even for a template with no meaningful
  // customer choice. Only multiple variants should become a grouped entry.
  if (item.variants.length > 1) {
    const prices = item.variants.map((variant) => variant.price)
    return {
      _id: item.id,
      _type: 'menuItemGroup',
      title: item.name,
      itemNames: item.variants.map((variant) => variant.label).join(' · '),
      priceRange: {
        minPrice: Math.min(...prices),
        maxPrice: Math.max(...prices),
      },
      stockStatus: item.stockStatus,
      variants: item.variants.map((variant) => ({
        id: variant.id,
        label: variant.label,
        price: variant.price,
        stockStatus: variant.stockStatus,
      })),
    }
  }

  return {
    _id: item.id,
    _type: 'menuItem',
    title: item.name,
    price: item.basePrice,
    isAvailable: item.stockStatus !== 'sold-out',
    stockStatus: item.stockStatus,
  }
}

export function toProjectedMenuSections(
  document: ProjectedMenuDocumentV1,
): MenuSection[] {
  return PROJECTED_MENU_SECTIONS.flatMap((configuredSection) => {
    const section = document.sections.find(({ id }) => id === configuredSection.id)
    if (!section || section.items.length === 0) return []

    return [{
      heading: configuredSection.name,
      metaCategory: configuredSection.metaCategory,
      items: [...section.items]
        .sort((left, right) => left.name.localeCompare(right.name))
        .map(toMenuItem),
    }]
  })
}

const LEGACY_PROJECTED_SECTION_HEADINGS = new Set([
  ...PROJECTED_MENU_SECTIONS.map(({ name }) => name.toLocaleLowerCase()),
  'tea time (hot or iced)',
])

const isProjectedSection = (section: MenuSection) =>
  LEGACY_PROJECTED_SECTION_HEADINGS.has(section.heading.trim().toLocaleLowerCase())

/**
 * Replaces all Odoo-owned menu sections wholesale. If projected data is
 * unavailable, old copies are removed rather than used as fallback.
 */
export function withProjectedMenu(
  board: MenuBoard,
  projectedSections: MenuSection[],
): MenuBoard {
  const sections = board.sections ?? []
  const firstProjectedIndex = sections.findIndex(isProjectedSection)
  const withoutProjected = sections.filter((section) => !isProjectedSection(section))

  if (projectedSections.length === 0) return { ...board, sections: withoutProjected }

  const insertAt = firstProjectedIndex < 0 ? 0 : firstProjectedIndex
  return {
    ...board,
    sections: [
      ...withoutProjected.slice(0, insertAt),
      ...projectedSections,
      ...withoutProjected.slice(insertAt),
    ],
  }
}
