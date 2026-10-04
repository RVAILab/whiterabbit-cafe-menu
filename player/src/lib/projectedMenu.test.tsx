// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { CategoryColumn } from '../components/CategoryColumn'
import type { MenuBoard } from '../types'
import {
  PROJECTED_MENU_SECTIONS,
  parseProjectedMenuDocument,
  toProjectedMenuSections,
  withProjectedMenu,
} from './projectedMenu'

const revision = 'abcdefghijklmnopqrstuvwxyzABCDEFGH123456789'

const item = (
  id: number,
  name: string,
  stockStatus: 'available' | 'sold-out' | 'untracked' = 'available',
) => ({
  id: `template-${id}`,
  templateId: id,
  name,
  basePrice: 4,
  stockStatus,
  variants: [{
    id: `product-${id}`,
    productId: id,
    label: name,
    price: 4,
    stockStatus,
  }],
})

const response = {
  schemaVersion: 1,
  generatedAt: '2026-08-12T18:00:00.000Z',
  availabilityRevision: revision,
  sections: [
    { id: 'cold-drinks', name: 'Cold Drinks', items: [item(6, 'Seltzer', 'untracked')] },
    { id: 'tea-time', name: 'Tea Time', items: [] },
    { id: 'eat-me', name: 'Eat Me', items: [item(2, 'Toastie')] },
    { id: 'chocolates', name: 'Chocolates', items: [item(3, 'Truffle')] },
    { id: 'zi-spice-chai', name: 'Zi Spice Chai', items: [item(5, 'Masala Chai')] },
    {
      id: 'noble-coffee',
      name: 'Noble Coffee',
      items: [
        {
          id: 'template-43',
          templateId: 43,
          name: 'Odoo Latte',
          basePrice: 5,
          stockStatus: 'available',
          variants: [
            { id: 'product-101', productId: 101, label: '8 oz', price: 5, stockStatus: 'available' },
            { id: 'product-102', productId: 102, label: '12 oz', price: 6, stockStatus: 'sold-out' },
          ],
        },
        item(42, 'Odoo Espresso', 'sold-out'),
      ],
    },
  ],
}

afterEach(cleanup)

describe('projected menu v1', () => {
  it('validates every section plus item-level and variant-level stock status', () => {
    expect(parseProjectedMenuDocument(response)).toEqual(response)
  })

  it.each([
    { ...response, schemaVersion: 2 },
    { ...response, generatedAt: 'not-a-date' },
    { ...response, availabilityRevision: 'not-a-sha256-digest' },
    { ...response, sections: response.sections.map((section) => section.id === 'tea-time' ? response.sections[0] : section) },
    { ...response, sections: [{ id: 'unknown', name: 'Unknown', items: [] }] },
    { ...response, sections: [{ id: 'tea-time', name: 'Wrong label', items: [] }] },
    { ...response, sections: [{ id: 'eat-me', name: 'Eat Me', items: [{ ...item(1, 'Soup'), stockStatus: 'maybe' }] }] },
    {
      ...response,
      sections: [{
        id: 'eat-me',
        name: 'Eat Me',
        items: [{ ...item(1, 'Soup'), variants: [{ ...item(1, 'Soup').variants[0], stockStatus: 'maybe' }] }],
      }],
    },
  ])('rejects an invalid document', (invalid) => {
    expect(() => parseProjectedMenuDocument(invalid)).toThrow('schema version 1')
  })

  it('accepts an ordered subset because empty sections are omitted by the compiler', () => {
    const subset = response.sections.filter(({ id }) => id !== 'tea-time')
    expect(parseProjectedMenuDocument({ ...response, sections: subset }).sections).toEqual(subset)
  })

  it.each([
    [],
    PROJECTED_MENU_SECTIONS.map(({ id, name }) => ({ id, name, items: [] })),
  ])('rejects a document without any menu items', (sections) => {
    expect(() => parseProjectedMenuDocument({ ...response, sections })).toThrow('schema version 1')
  })

  it('uses fixed section order and omits empty sections', () => {
    const sections = toProjectedMenuSections(parseProjectedMenuDocument(response))

    expect(sections.map(({ heading }) => heading)).toEqual([
      'Noble Coffee',
      'Eat Me',
      'Chocolates',
      'Zi Spice Chai',
      'Cold Drinks',
    ])
    expect(sections[0].items?.map(({ title }) => title)).toEqual([
      'Odoo Espresso',
      'Odoo Latte',
    ])
  })

  it('displays every size label and price and does not present a sold-out size as sellable', () => {
    const section = toProjectedMenuSections(parseProjectedMenuDocument(response))[0]
    render(<CategoryColumn section={section} />)

    expect(screen.getByText('Odoo Latte')).toBeTruthy()
    expect(screen.getByText(/8 oz 5\.00/)).toBeTruthy()
    const soldOutSize = screen.getByText(/12 oz 6\.00 SOLD OUT/)
    expect(soldOutSize.className).toContain('opacity-40')
    expect(soldOutSize.getAttribute('style')).toContain('line-through')
  })

  it('keeps a sold-out item visible, dimmed, and labeled while untracked stays available', () => {
    const sections = toProjectedMenuSections(parseProjectedMenuDocument(response))
    const coffee = sections.find(({ heading }) => heading === 'Noble Coffee')!
    const coldDrinks = sections.find(({ heading }) => heading === 'Cold Drinks')!

    const { rerender } = render(<CategoryColumn section={coffee} ignoreStockLevels />)
    const espresso = screen.getByText('Odoo Espresso').closest('[class]')
    expect(screen.getByText('SOLD OUT')).toBeTruthy()
    expect(espresso?.className).toContain('opacity-40')

    rerender(<CategoryColumn section={coldDrinks} />)
    expect(screen.getByText('Seltzer').closest('[class]')?.className).not.toContain('opacity-40')
    expect(screen.queryByText('SOLD OUT')).toBeNull()
  })

  it('removes all six legacy menu sections, including the Tea alias', () => {
    const projectedHeadings = [
      'Noble Coffee',
      'Eat Me',
      'Chocolates',
      'Tea Time (Hot or Iced)',
      'Zi Spice Chai',
      'Cold Drinks',
    ]
    const legacyBoard: MenuBoard = {
      title: 'Menu',
      slug: { current: 'menu' },
      sections: [
        { heading: 'Preserved Legacy Content', metaCategory: 'eat-me', items: [] },
        ...projectedHeadings.map((heading) => ({
          heading,
          metaCategory: 'drink-me' as const,
          items: [itemAsLegacy('Stale Legacy Item')],
        })),
      ],
    }

    const withoutFallback = withProjectedMenu(legacyBoard, [])
    expect(withoutFallback.sections?.map(({ heading }) => heading)).toEqual(['Preserved Legacy Content'])

    const replaced = withProjectedMenu(
      legacyBoard,
      toProjectedMenuSections(parseProjectedMenuDocument(response)),
    )
    expect(replaced.sections?.map(({ heading }) => heading)).toEqual([
      'Preserved Legacy Content',
      'Noble Coffee',
      'Eat Me',
      'Chocolates',
      'Zi Spice Chai',
      'Cold Drinks',
    ])
    expect(JSON.stringify(replaced)).not.toContain('Stale Legacy Item')
  })
})

const responseV2 = {
  schemaVersion: 2,
  generatedAt: '2026-09-29T18:00:00.000Z',
  availabilityRevision: revision,
  sections: [
    {
      id: 'noble-coffee',
      name: 'Noble Coffee',
      side: 'drink-me',
      position: 0,
      items: [item(42, 'Odoo Espresso'), item(7, 'Cortado'), item(43, 'Americano')],
    },
    {
      id: 'autumn-specials',
      name: 'Autumn Specials',
      side: 'drink-me',
      position: 1,
      items: [item(8, 'Pumpkin Latte')],
    },
    { id: 'eat-me', name: 'Eat Me', side: 'eat-me', position: 0, items: [item(2, 'Toastie')] },
  ],
}

describe('projected menu v2', () => {
  it('validates a document whose sections the player has never seen', () => {
    expect(parseProjectedMenuDocument(responseV2)).toEqual(responseV2)
  })

  it('renders sections under the heading and side given in the document', () => {
    const sections = toProjectedMenuSections(parseProjectedMenuDocument(responseV2))

    expect(sections.map(({ heading, metaCategory }) => [heading, metaCategory])).toEqual([
      ['Noble Coffee', 'drink-me'],
      ['Autumn Specials', 'drink-me'],
      ['Eat Me', 'eat-me'],
    ])
  })

  it('keeps items in server order without an alphabetical sort', () => {
    const sections = toProjectedMenuSections(parseProjectedMenuDocument(responseV2))

    expect(sections[0].items?.map(({ title }) => title)).toEqual([
      'Odoo Espresso',
      'Cortado',
      'Americano',
    ])
  })

  it('orders sections by position within each side, keeping array order on ties', () => {
    const sections = toProjectedMenuSections(parseProjectedMenuDocument({
      ...responseV2,
      sections: [
        { id: 'late', name: 'Late', side: 'eat-me', position: 0, items: [item(1, 'Soup')] },
        { id: 'third', name: 'Third', side: 'drink-me', position: 5, items: [item(2, 'Tea')] },
        { id: 'first', name: 'First', side: 'drink-me', position: 1, items: [item(3, 'Mocha')] },
        { id: 'second', name: 'Second', side: 'drink-me', position: 1, items: [item(4, 'Chai')] },
        { id: 'early', name: 'Early', side: 'eat-me', position: 0, items: [item(5, 'Bagel')] },
      ],
    }))

    expect(sections.map(({ heading }) => heading)).toEqual([
      'First',
      'Second',
      'Third',
      'Late',
      'Early',
    ])
  })

  it('accepts the bar side and renders it after eat-me', () => {
    const sections = toProjectedMenuSections(parseProjectedMenuDocument({
      ...responseV2,
      sections: [
        { id: 'alcohol', name: 'Alcohol', side: 'bar', position: 0, items: [item(9, 'Cider')] },
        ...responseV2.sections,
      ],
    }))

    expect(sections.map(({ heading, metaCategory }) => [heading, metaCategory])).toEqual([
      ['Noble Coffee', 'drink-me'],
      ['Autumn Specials', 'drink-me'],
      ['Eat Me', 'eat-me'],
      ['Alcohol', 'bar'],
    ])
  })

  it('omits an empty section', () => {
    const sections = toProjectedMenuSections(parseProjectedMenuDocument({
      ...responseV2,
      sections: [
        ...responseV2.sections,
        { id: 'empty', name: 'Empty', side: 'eat-me', position: 1, items: [] },
      ],
    }))

    expect(sections.map(({ heading }) => heading)).not.toContain('Empty')
  })

  const section = responseV2.sections[1]

  it.each([
    ['a v1 section shape', { ...responseV2, sections: response.sections }],
    ['a missing generatedAt', { ...responseV2, generatedAt: undefined }],
    ['a bad availabilityRevision', { ...responseV2, availabilityRevision: 'short' }],
    ['a non-slug id', { ...responseV2, sections: [{ ...section, id: 'Autumn Specials' }] }],
    ['an over-long id', { ...responseV2, sections: [{ ...section, id: 'a'.repeat(65) }] }],
    ['an empty name', { ...responseV2, sections: [{ ...section, name: '' }] }],
    ['an unknown side', { ...responseV2, sections: [{ ...section, side: 'sip-me' }] }],
    ['a capitalized side', { ...responseV2, sections: [{ ...section, side: 'Bar' }] }],
    ['a fractional position', { ...responseV2, sections: [{ ...section, position: 1.5 }] }],
    ['a negative position', { ...responseV2, sections: [{ ...section, position: -1 }] }],
    ['a string position', { ...responseV2, sections: [{ ...section, position: '1' }] }],
    ['an invalid item', { ...responseV2, sections: [{ ...section, items: [{ ...item(1, 'Soup'), templateId: 0 }] }] }],
    ['duplicate section ids', { ...responseV2, sections: [section, { ...section, position: 2 }] }],
    ['no menu items', { ...responseV2, sections: responseV2.sections.map((each) => ({ ...each, items: [] })) }],
    ['no sections', { ...responseV2, sections: [] }],
  ])('rejects %s', (_, invalid) => {
    expect(() => parseProjectedMenuDocument(invalid)).toThrow('schema version 1 or 2')
  })
})

function itemAsLegacy(title: string) {
  return {
    _id: title,
    _type: 'menuItem' as const,
    title,
    price: 99,
    isAvailable: true,
  }
}
