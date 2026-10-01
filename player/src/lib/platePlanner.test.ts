import { describe, expect, it } from 'vitest'
import { planPlates } from './platePlanner'
import type {
  ProjectedMenuDocumentV1,
  ProjectedMenuDocumentV2,
  ProjectedMenuItemV1,
  ProjectedMenuSectionV2,
} from './projectedMenu'
import { sampleProjectedMenu } from '../test/fixtures/sampleProjectedMenu'

const ids = (plates: ReturnType<typeof planPlates>) =>
  plates.map((plate) => plate.map((section) => section.id))

let nextId = 1
function item(name = `Item ${nextId}`): ProjectedMenuItemV1 {
  const id = nextId++
  return {
    id: `odoo-template-${id}`,
    templateId: id,
    name,
    basePrice: 5,
    stockStatus: 'available',
    variants: [{ id: `odoo-product-${id}`, productId: id, label: name, price: 5, stockStatus: 'available' }],
  }
}

function section(
  id: string,
  side: ProjectedMenuSectionV2['side'],
  position: number,
  itemCount: number,
): ProjectedMenuSectionV2 {
  return { id, name: id, side, position, items: Array.from({ length: itemCount }, () => item()) }
}

function doc(sections: ProjectedMenuSectionV2[]): ProjectedMenuDocumentV2 {
  return { ...sampleProjectedMenu, sections }
}

describe('planPlates', () => {
  it('lands the sample document on the expected three plates', () => {
    // Estimated lines: Noble 9.4, Chocolates 6.2, Tea Time 9.2, Zi 4.2.
    // Splitting after Chocolates gives max(15.6, 13.4), the lowest tallest column.
    expect(ids(planPlates(sampleProjectedMenu))).toEqual([
      ['noble-coffee', 'chocolates'],
      ['tea-time', 'zi-spice-chai'],
      ['savory', 'sweet'],
    ])
  })

  it('orders each side by position, not array order', () => {
    const plates = planPlates(doc([
      section('sweet', 'eat-me', 2, 2),
      section('second', 'drink-me', 1, 3),
      section('savory', 'eat-me', 1, 2),
      section('first', 'drink-me', 0, 3),
    ]))

    expect(ids(plates)).toEqual([['first'], ['second'], ['savory', 'sweet']])
  })

  it('chooses the split that minimizes the taller column', () => {
    // Lines: 2.4, 2.4, 2.4, 9.4. Any split leaving the big one alone wins.
    expect(ids(planPlates(doc([
      section('a', 'drink-me', 0, 1),
      section('b', 'drink-me', 1, 1),
      section('c', 'drink-me', 2, 1),
      section('d', 'drink-me', 3, 8),
    ])))).toEqual([['a', 'b', 'c'], ['d'], []])

    // Lines: 9.4, 2.4, 2.4, 2.4. The big one goes alone on plate 1.
    expect(ids(planPlates(doc([
      section('a', 'drink-me', 0, 8),
      section('b', 'drink-me', 1, 1),
      section('c', 'drink-me', 2, 1),
      section('d', 'drink-me', 3, 1),
    ])))).toEqual([['a'], ['b', 'c', 'd'], []])
  })

  it('counts long names and variant groups as taller items', () => {
    // a: 1.4 + 1.8 (name over 22 chars) * 3 = 6.8
    // b: 1.4 + 1.6 (two sizes) * 2 = 4.6, c: 1.4 + (1 + 4 * 0.75) (eight teas) = 5.4
    // Split after a: max(6.8, 10.0) = 10.0. Split after b: max(11.4, 5.4) = 11.4.
    const long = (n: number) => item(`A Very Long Item Name Number ${n}`)
    const sized = (): ProjectedMenuItemV1 => ({
      ...item(),
      variants: ['8oz', '12oz'].map((label, i) => ({
        id: `v-${nextId}-${i}`, productId: nextId * 10 + i, label, price: 6, stockStatus: 'available' as const,
      })),
    })
    const teas = (): ProjectedMenuItemV1 => ({
      ...item(),
      variants: Array.from({ length: 8 }, (_, i) => ({
        id: `t-${i}`, productId: 900 + i, label: `Tea ${i}`, price: 4, stockStatus: 'available' as const,
      })),
    })

    expect(ids(planPlates(doc([
      { ...section('a', 'drink-me', 0, 0), items: [long(1), long(2), long(3)] },
      { ...section('b', 'drink-me', 1, 0), items: [sized(), sized()] },
      { ...section('c', 'drink-me', 2, 0), items: [teas()] },
    ])))).toEqual([['a'], ['b', 'c'], []])
  })

  it('drops empty sections', () => {
    const plates = planPlates(doc([
      section('a', 'drink-me', 0, 3),
      section('empty-drink', 'drink-me', 1, 0),
      section('b', 'drink-me', 2, 3),
      section('empty-eat', 'eat-me', 0, 0),
      section('c', 'eat-me', 1, 2),
    ]))

    expect(ids(plates)).toEqual([['a'], ['b'], ['c']])
  })

  it('flows a new drink-me section in after the existing ones', () => {
    const withColdDrinks = doc([
      ...sampleProjectedMenu.sections,
      section('cold-drinks', 'drink-me', 4, 2),
    ])

    expect(ids(planPlates(withColdDrinks))).toEqual([
      ['noble-coffee', 'chocolates'],
      ['tea-time', 'zi-spice-chai', 'cold-drinks'],
      ['savory', 'sweet'],
    ])
  })

  it('leaves plate 3 empty when the eat-me side is empty', () => {
    const drinksOnly = doc(sampleProjectedMenu.sections.filter((s) => s.side === 'drink-me'))

    expect(ids(planPlates(drinksOnly))[2]).toEqual([])
  })

  it('maps a v1 document through the static section metadata', () => {
    const v1: ProjectedMenuDocumentV1 = {
      schemaVersion: 1,
      generatedAt: sampleProjectedMenu.generatedAt,
      availabilityRevision: sampleProjectedMenu.availabilityRevision,
      sections: [
        { id: 'tea-time', name: 'Tea Time', items: [item(), item()] },
        { id: 'eat-me', name: 'Eat Me', items: [item()] },
        { id: 'noble-coffee', name: 'Noble Coffee', items: [item(), item()] },
      ],
    }

    expect(ids(planPlates(v1))).toEqual([['noble-coffee'], ['tea-time'], ['eat-me']])
  })
})
