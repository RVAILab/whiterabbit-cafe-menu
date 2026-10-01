// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProjectedMenuDocumentV2 } from '../lib/projectedMenu'
import { sampleProjectedMenu } from '../test/fixtures/sampleProjectedMenu'
import {
  displayControlV1,
  displayControlV2,
  renderProjection,
  stubLocalStorage,
  stubProjectionServer,
  type ProjectionServer,
} from '../test/projectionHarness'

/* #25: menu changes land inside the gulp, at the route seam under fake timers. */

const MENU_POLL_MS = 20_000

let server: ProjectionServer

function stubBrowser() {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() =>
    new Proxy({}, { get: () => () => ({ addColorStop: () => {} }) })) as unknown as HTMLCanvasElement['getContext'])
}

/** The sample menu with the Latte at `price` and a revision derived from it. */
function menuWithLattePrice(price: number): ProjectedMenuDocumentV2 {
  const menu = structuredClone(sampleProjectedMenu)
  menu.availabilityRevision = `latte-${price.toFixed(2).replace('.', '_')}`.padEnd(43, 'x')
  const latte = menu.sections[0].items[0]
  latte.basePrice = price
  latte.variants[0].price = price
  return menu
}

beforeEach(() => {
  vi.useFakeTimers()
  stubLocalStorage()
  server = { projectedMenu: menuWithLattePrice(8.11), displayControl: displayControlV1() }
  stubProjectionServer(server)
  stubBrowser()
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const advance = async (ms: number) => {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms) })
}
async function boot(path: string) {
  renderProjection(path)
  for (let i = 0; i < 5; i++) await advance(0)
}
const stage = () => screen.getByTestId('rabbit-hole-stage')
const isGulping = () => stage().classList.contains('gulping')
const menuText = () => screen.getByTestId('rabbit-hole-menu').textContent ?? ''
const press = (key: string) => act(() => { fireEvent.keyDown(document.body, { key }) })

/** Change the server's menu and run up to (and including) the next menu poll. */
async function publishAndPoll(price: number) {
  server.projectedMenu = menuWithLattePrice(price)
  await advance(MENU_POLL_MS)
}

describe('menu changes in the rabbit hole', () => {
  it('shows the first menu without a gulp', async () => {
    await boot('/projection?layout=rabbit-hole')
    expect(menuText()).toContain('8.11')
    expect(isGulping()).toBe(false)
  })

  it('holds a new menu back and swaps it in at 1300ms, inside a gulp', async () => {
    await boot('/projection?layout=rabbit-hole')
    await publishAndPoll(8.22)

    expect(isGulping()).toBe(true)
    expect(menuText()).toContain('8.11')
    expect(menuText()).not.toContain('8.22')

    await advance(1299)
    expect(menuText()).toContain('8.11')
    await advance(1)
    expect(menuText()).toContain('8.22')
    expect(menuText()).not.toContain('8.11')
  })

  it('merges two changes before the swap into one swap showing the latest', async () => {
    // Poll faster than the swap point by driving a second poll with the online event.
    await boot('/projection?layout=rabbit-hole')
    await publishAndPoll(8.22)
    expect(isGulping()).toBe(true)

    server.projectedMenu = menuWithLattePrice(8.33)
    await act(async () => {
      window.dispatchEvent(new Event('online'))
      await vi.advanceTimersByTimeAsync(500)
    })
    expect(menuText()).toContain('8.11')

    await advance(800) // 1300 from the gulp start
    expect(menuText()).toContain('8.33')
    expect(menuText()).not.toContain('8.22')
    // One gulp: it releases at 2600 and does not restart.
    await advance(1300)
    expect(isGulping()).toBe(false)
    await advance(5000)
    expect(isGulping()).toBe(false)
  })

  it('applies a change after the swap but before re-arm when the gulp re-arms (immediately, within the 60s gap)', async () => {
    await boot('/projection?layout=rabbit-hole')
    await publishAndPoll(8.22)
    await advance(1300)
    expect(menuText()).toContain('8.22')

    server.projectedMenu = menuWithLattePrice(8.33)
    await act(async () => {
      window.dispatchEvent(new Event('online'))
      await vi.advanceTimersByTimeAsync(500) // 1800
    })
    expect(menuText()).toContain('8.22')

    await advance(2499) // 4299
    expect(menuText()).toContain('8.22')
    await advance(1) // 4300: re-armed; refused by the gap, so applied now
    expect(menuText()).toContain('8.33')
    expect(isGulping()).toBe(false)
  })

  it('applies a change within 60s of the last gulp immediately, without gulping', async () => {
    await boot('/projection?layout=rabbit-hole')
    press('g')
    await advance(4300)
    expect(isGulping()).toBe(false)

    await publishAndPoll(8.22) // 24.3s after the G gulp
    expect(isGulping()).toBe(false)
    expect(menuText()).toContain('8.22')
  })

  it('gulps again for a change more than 60s after the last gulp', async () => {
    await boot('/projection?layout=rabbit-hole')
    await publishAndPoll(8.22)
    await advance(4300)

    for (let i = 0; i < 3; i++) await advance(MENU_POLL_MS) // ~64s since the gulp
    await publishAndPoll(8.33)
    expect(isGulping()).toBe(true)
    expect(menuText()).toContain('8.22')
    await advance(1300)
    expect(menuText()).toContain('8.33')
  })

  it('does not gulp when a poll returns the same revision', async () => {
    await boot('/projection?layout=rabbit-hole')
    await publishAndPoll(8.11)
    expect(isGulping()).toBe(false)
    expect(menuText()).toContain('8.11')
  })

  it('applies immediately when display control sets onMenuChange: false', async () => {
    server.displayControl = displayControlV2({
      desired: {
        layout: 'rabbit-hole',
        rabbitHole: { variant: 'dive', speed: 0.4, gulp: { enabled: true, intervalMinutes: 15, onMenuChange: false } },
      },
    })
    await boot('/projection')
    expect(menuText()).toContain('8.11')

    await publishAndPoll(8.22)
    expect(isGulping()).toBe(false)
    expect(menuText()).toContain('8.22')
  })

  it('gulps on a menu change when display control v2 leaves onMenuChange on', async () => {
    server.displayControl = displayControlV2({ desired: { layout: 'rabbit-hole' } })
    await boot('/projection')
    await publishAndPoll(8.22)
    expect(isGulping()).toBe(true)
    expect(menuText()).toContain('8.11')
  })

  it('applies immediately when the gulp is refused by an overlay', async () => {
    await boot('/projection?layout=rabbit-hole')
    server.displayControl = displayControlV1({
      revision: 2,
      desired: { overlay: 'closed', visualization: 'none', visualizationMode: 'background' },
    })
    server.projectedMenu = menuWithLattePrice(8.22)
    await advance(MENU_POLL_MS)
    expect(isGulping()).toBe(false)
    expect(menuText()).toContain('8.22')
  })

  it('never loses the held menu when the layout switches mid-gulp', async () => {
    server.displayControl = displayControlV2({ desired: { layout: 'rabbit-hole' } })
    await boot('/projection')
    await publishAndPoll(8.22)
    expect(isGulping()).toBe(true)

    // Switch to standard before the swap point, then back.
    server.displayControl = displayControlV2({ revision: 2, desired: { layout: 'standard' } })
    await advance(MENU_POLL_MS) // the display-control poll lands within this
    expect(screen.queryByTestId('rabbit-hole-stage')).toBeNull()
    expect(screen.getAllByText(/8\.22/).length).toBeGreaterThan(0)

    server.displayControl = displayControlV2({ revision: 3, desired: { layout: 'rabbit-hole' } })
    await advance(MENU_POLL_MS)
    expect(menuText()).toContain('8.22')
    expect(isGulping()).toBe(false)
  })
})

describe('menu changes in the standard layout', () => {
  it('apply as soon as the poll lands', async () => {
    await boot('/projection')
    expect(screen.getAllByText(/8\.11/).length).toBeGreaterThan(0)
    await publishAndPoll(8.22)
    expect(screen.getAllByText(/8\.22/).length).toBeGreaterThan(0)
    expect(screen.queryAllByText(/8\.11/)).toHaveLength(0)
  })
})

describe('menu changes after the rabbit hole fell back to the standard layout', () => {
  /** jsdom has no layout: plates are 800px tall and only a menu with the Latte at 8.22 overflows them. */
  function stubOverflowAt822() {
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this.classList.contains('rh-plate') ? 800 : 0
    })
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function (this: HTMLElement) {
      if (!this.classList.contains('rh-plate')) return 0
      return this.closest('.rh-menu')?.textContent?.includes('8.22') ? 2000 : 600
    })
  }

  it('shows a newer menu that fits at once, without gulping the overflowing one back in', async () => {
    stubOverflowAt822()
    await boot('/projection?layout=rabbit-hole')
    await publishAndPoll(8.22)
    await advance(1300) // swapped in, does not fit → standard layout
    expect(screen.queryByTestId('rabbit-hole-stage')).toBeNull()
    await advance(60_000) // past the gap, so a gulp would be accepted

    await publishAndPoll(8.33)
    expect(menuText()).toContain('8.33')
    expect(menuText()).not.toContain('8.22')
    expect(isGulping()).toBe(false)
  })
})
