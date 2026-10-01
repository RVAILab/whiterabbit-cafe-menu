// @vitest-environment jsdom
import { cleanup, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProjectedMenuDocumentV2 } from '../lib/projectedMenu'
import { sampleProjectedMenu } from '../test/fixtures/sampleProjectedMenu'
import {
  displayControlV1,
  renderProjection,
  stubLocalStorage,
  stubProjectionServer,
  type ProjectionServer,
} from '../test/projectionHarness'

function menuWithStockChanges(): ProjectedMenuDocumentV2 {
  const menu = structuredClone(sampleProjectedMenu)
  const find = (name: string) => menu.sections.flatMap((s) => s.items).find((i) => i.name === name)!
  find('Americano').stockStatus = 'sold-out'
  find('Americano').variants[0].stockStatus = 'sold-out'
  find('Golden Chocolate').variants[1].stockStatus = 'sold-out'
  find('Loose Leaf Teas').variants.find((v) => v.label === 'Earl Grey')!.stockStatus = 'sold-out'
  return menu
}

let server: ProjectionServer

beforeEach(() => {
  stubLocalStorage()
  server = { projectedMenu: menuWithStockChanges(), displayControl: displayControlV1() }
  stubProjectionServer(server)
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const plate = (n: 1 | 2 | 3) => screen.getByTestId(`rabbit-hole-plate-${n}`)
const itemNamed = (container: HTMLElement, name: string) =>
  within(container).getByText(name).closest<HTMLElement>('[data-rh-item]')!

describe('/projection?layout=rabbit-hole', () => {
  it('replaces the standard board with the rabbit hole stage', async () => {
    renderProjection('/projection?layout=rabbit-hole')

    const stage = await screen.findByTestId('rabbit-hole-stage')
    expect(within(stage).getByRole('heading', { name: 'Drink ✦ Me' })).toBeTruthy()
    expect(within(stage).getByRole('heading', { name: 'Eat ✦ Me' })).toBeTruthy()
    // Only one copy of the menu is on screen.
    expect(screen.getAllByText('Noble Coffee')).toHaveLength(1)
  })

  it('puts the live sections on the planned plates, in order', async () => {
    renderProjection('/projection?layout=rabbit-hole')
    await screen.findByTestId('rabbit-hole-stage')

    const headings = (n: 1 | 2 | 3) =>
      within(plate(n)).getAllByRole('heading').map((h) => h.textContent)
    expect(headings(1)).toEqual(['Noble Coffee', 'Chocolates'])
    expect(headings(2)).toEqual(['Tea Time', 'Zi Spice Chai'])
    expect(headings(3)).toEqual(['Savory', 'Sweet'])
  })

  it('shows a single-variant item as a name and a two-decimal price', async () => {
    renderProjection('/projection?layout=rabbit-hole')
    await screen.findByTestId('rabbit-hole-stage')

    const latte = itemNamed(plate(1), 'Latte')
    expect(within(latte).getByText('5.50')).toBeTruthy()
    const quiche = itemNamed(plate(3), 'Quiche special')
    expect(within(quiche).getByText('10.00')).toBeTruthy()
  })

  it('shows two or three sizes as a gold sub-line', async () => {
    renderProjection('/projection?layout=rabbit-hole')
    await screen.findByTestId('rabbit-hole-stage')

    const blossom = itemNamed(plate(1), 'Chocolate Blossom')
    expect(blossom.querySelector('[data-rh-subline]')?.textContent).toBe('8oz 6.00 · 12oz 9.00')
  })

  it('shows four or more variants as a variant grid', async () => {
    renderProjection('/projection?layout=rabbit-hole')
    await screen.findByTestId('rabbit-hole-stage')

    const teas = itemNamed(plate(2), 'Loose Leaf Teas')
    const grid = teas.querySelector<HTMLElement>('[data-rh-variant-grid]')!
    expect(grid.children).toHaveLength(8)
    expect(within(grid).getByText('Wonderland').parentElement?.textContent).toContain('4.50')
  })

  it('marks sold-out items and variants the way the standard board does', async () => {
    renderProjection('/projection?layout=rabbit-hole')
    await screen.findByTestId('rabbit-hole-stage')

    const americano = itemNamed(plate(1), 'Americano')
    expect(americano.className).toContain('opacity-40')
    expect(within(americano).getByText('SOLD OUT')).toBeTruthy()
    expect(itemNamed(plate(1), 'Latte').className).not.toContain('opacity-40')

    const golden = itemNamed(plate(1), 'Golden Chocolate')
    const twelve = within(golden).getByText(/12oz 9\.00/)
    expect(twelve.className).toContain('opacity-40')
    expect(twelve.style.textDecoration).toBe('line-through')
    expect(twelve.textContent).toContain('SOLD OUT')
    expect(within(golden).getByText(/8oz 6\.00/).className).not.toContain('opacity-40')

    const earlGrey = within(itemNamed(plate(2), 'Loose Leaf Teas')).getByText('Earl Grey').parentElement!
    expect(earlGrey.className).toContain('opacity-40')
    expect(earlGrey.style.textDecoration).toBe('line-through')
    expect(earlGrey.textContent).toContain('SOLD OUT')
  })

  it('shows the members discount and the time in the HUD', async () => {
    renderProjection('/projection?layout=rabbit-hole')

    const hud = await screen.findByTestId('rabbit-hole-hud')
    expect(hud.textContent).toMatch(/^Members 15% off · \d{1,2}:\d{2}\s[AP]M$/)
  })

  it('still renders overlays on top of the stage', async () => {
    server.displayControl = displayControlV1({
      desired: { overlay: 'closed', visualization: 'none', visualizationMode: 'background' },
    })
    renderProjection('/projection?layout=rabbit-hole')

    const stage = await screen.findByTestId('rabbit-hole-stage')
    const overlays = within(stage).getByTestId('rabbit-hole-layer-overlays')
    await vi.waitFor(() => expect(overlays.childElementCount).toBeGreaterThan(0))
  })
})

describe('/projection without a layout override', () => {
  it('renders the standard board', async () => {
    renderProjection('/projection')

    expect(await screen.findByText('Noble Coffee')).toBeTruthy()
    expect(screen.queryByTestId('rabbit-hole-stage')).toBeNull()
  })
})
