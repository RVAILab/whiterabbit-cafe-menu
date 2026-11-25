import { describe, expect, it } from 'vitest'
import type { ProjectedMenuDocumentV2, ProjectedMenuSectionV2 } from '../lib/projectedMenu'
import type { MetaCategory } from '../types'
import { formatPrice, itemPrice, planFeatured } from './planFeatured'

const item = (id: number, name: string, variants: [string, number][] = [[name, 4]]) => ({
  id: `template-${id}`,
  templateId: id,
  name,
  basePrice: variants[0][1],
  stockStatus: 'available' as const,
  variants: variants.map(([label, price], i) => ({
    id: `product-${id}-${i}`,
    productId: id * 10 + i + 1,
    label,
    price,
    stockStatus: 'available' as const,
  })),
})

let nextId = 1
const section = (
  name: string,
  side: MetaCategory,
  position: number,
  extra: Partial<ProjectedMenuSectionV2> = {},
): ProjectedMenuSectionV2 => ({
  id: name.toLowerCase().replace(/\s+/g, '-'),
  name,
  side,
  position,
  items: [item(nextId++, `${name} A`), item(nextId++, `${name} B`), item(nextId++, `${name} C`)],
  ...extra,
})

const doc = (...sections: ProjectedMenuSectionV2[]): ProjectedMenuDocumentV2 => ({
  schemaVersion: 2,
  generatedAt: '2026-11-25T10:00:00.000Z',
  availabilityRevision: 'x'.repeat(43),
  sections,
})

describe('planFeatured', () => {
  it('features the item named by featuredItemId and removes it from the list', () => {
    const coffee = section('Coffee', 'drink-me', 0)
    const plan = planFeatured(doc({ ...coffee, featuredItemId: coffee.items[1].id }))

    expect(plan.drinks[0].featured?.name).toBe('Coffee B')
    expect(plan.drinks[0].items.map(({ name }) => name)).toEqual(['Coffee A', 'Coffee C'])
  })

  it('falls back to the first item when featuredItemId is absent, null or unknown', () => {
    for (const featuredItemId of [undefined, null, 'template-999']) {
      const plan = planFeatured(doc(section('Coffee', 'drink-me', 0, { featuredItemId })))
      expect(plan.drinks[0].featured?.name).toBe('Coffee A')
      expect(plan.drinks[0].items.map(({ name }) => name)).toEqual(['Coffee B', 'Coffee C'])
    }
  })

  it('orders drink blocks by position, food blocks likewise, pictures only the first food section and ignores the bar', () => {
    const plan = planFeatured(doc(
      section('Sweet', 'eat-me', 1),
      section('Chai', 'drink-me', 2),
      section('Beer', 'bar', 0),
      section('Coffee', 'drink-me', 0),
      section('Savory', 'eat-me', 0),
      section('Matcha', 'drink-me', 1),
      section('Empty', 'drink-me', 3, { items: [] }),
    ))

    expect(plan.drinks.map(({ label }) => label)).toEqual(['Coffee', 'Matcha', 'Chai'])
    expect(plan.food.map(({ label }) => label)).toEqual(['Savory', 'Sweet'])
    expect(plan.food[0].featured?.name).toBe('Savory A')
    expect(plan.food[1].featured).toBeUndefined()
    expect(plan.food[1].items).toHaveLength(3)
  })

  it('shows at most five drink sections', () => {
    const plan = planFeatured(doc(...['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((n, i) => section(n, 'drink-me', i))))
    expect(plan.drinks.map(({ label }) => label)).toEqual(['A', 'B', 'C', 'D', 'E'])
    expect(plan.food).toEqual([])
  })
})

describe('prices', () => {
  it('formats whole numbers without decimals, else two decimals', () => {
    expect(formatPrice(6)).toBe('6')
    expect(formatPrice(5.5)).toBe('5.50')
    expect(formatPrice(4.25)).toBe('4.25')
  })

  it('shows sizes ascending, other choices as "from", a single variant as its base price', () => {
    expect(itemPrice(item(1, 'Latte', [['12 oz', 5.5], ['8oz', 4.75]]))).toBe('4.75 / 5.50')
    expect(itemPrice(item(2, 'Loose Leaf Teas', [['Earl Grey', 3.5], ['Sencha', 3]]))).toBe('from 3')
    expect(itemPrice(item(3, 'Espresso', [['Espresso', 4]]))).toBe('4')
    expect(itemPrice({ ...item(4, 'Soup'), basePrice: 6.25, variants: [] })).toBe('6.25')
  })
})
