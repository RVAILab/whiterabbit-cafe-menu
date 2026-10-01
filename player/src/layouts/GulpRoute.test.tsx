// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sampleProjectedMenu } from '../test/fixtures/sampleProjectedMenu'
import {
  displayControlV1,
  renderProjection,
  stubLocalStorage,
  stubProjectionServer,
  type ProjectionServer,
} from '../test/projectionHarness'

/* The gulp at the route seam: G key → stage timeline, under fake timers. */

let server: ProjectionServer
let reducedMotion = false

function stubBrowser() {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('prefers-reduced-motion') && reducedMotion,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() =>
    new Proxy({}, { get: () => () => ({ addColorStop: () => {} }) })) as unknown as HTMLCanvasElement['getContext'])
}

beforeEach(() => {
  vi.useFakeTimers()
  reducedMotion = false
  stubLocalStorage()
  server = { projectedMenu: structuredClone(sampleProjectedMenu), displayControl: displayControlV1() }
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
/** Let the first polls land and the layout settle. */
async function boot(path: string) {
  renderProjection(path)
  for (let i = 0; i < 5; i++) await advance(0)
}
const stage = () => screen.getByTestId('rabbit-hole-stage')
const isGulping = () => stage().classList.contains('gulping')
const press = (key: string, init: Partial<KeyboardEventInit> = {}) =>
  act(() => { fireEvent.keyDown(document.body, { key, ...init }) })

describe('the gulp on /projection?layout=rabbit-hole', () => {
  it('runs the timeline on G: gulping at once, cleared at 2600, re-armed by 4300', async () => {
    await boot('/projection?layout=rabbit-hole')
    expect(isGulping()).toBe(false)

    press('g')
    expect(isGulping()).toBe(true)
    expect(screen.getByTestId('gulp-hic').textContent).toBe('*hic*')

    await advance(2599)
    expect(isGulping()).toBe(true)
    await advance(1)
    expect(isGulping()).toBe(false)

    // Still springing back: G is refused until re-arm.
    press('G')
    expect(isGulping()).toBe(false)

    await advance(1700) // 4300: re-armed, and G skips the 60s gap
    press('G')
    expect(isGulping()).toBe(true)
  })

  it('measures each target to the hole at trigger time, staggered by data-gulp-order', async () => {
    await boot('/projection?layout=rabbit-hole')
    press('g')

    const targets = [...stage().querySelectorAll<HTMLElement>('.rh-gulp-target')]
    expect(targets).toHaveLength(5) // 2 titles + 3 plates
    for (const target of targets) {
      // jsdom has no layout: every offset is 0, so dx/dy is the hole center (300, 520).
      expect(target.style.getPropertyValue('--dx')).toBe('300px')
      expect(target.style.getPropertyValue('--dy')).toBe('520px')
    }
    const plates = [1, 2, 3].map((n) => screen.getByTestId(`rabbit-hole-plate-${n}`))
    expect(plates.map((p) => p.style.getPropertyValue('--in-delay'))).toEqual(['0s', '0.1s', '0.2s'])
    expect(plates.map((p) => p.style.getPropertyValue('--ret-delay'))).toEqual(['0s', '0.12s', '0.24s'])
  })

  it('refuses while already gulping (the timeline is not restarted)', async () => {
    await boot('/projection?layout=rabbit-hole')
    press('g')
    await advance(500)
    press('g')
    await advance(2100) // 2600 from the first G
    expect(isGulping()).toBe(false)
  })

  it('refuses during an overlay', async () => {
    server.displayControl = displayControlV1({
      desired: { overlay: 'closed', visualization: 'none', visualizationMode: 'background' },
    })
    await boot('/projection?layout=rabbit-hole')
    press('g')
    expect(isGulping()).toBe(false)
  })

  it('refuses under prefers-reduced-motion', async () => {
    reducedMotion = true
    await boot('/projection?layout=rabbit-hole')
    press('g')
    expect(isGulping()).toBe(false)
  })

  it('does not gulp while calibrating (calibration owns the keyboard)', async () => {
    await boot('/projection?layout=rabbit-hole')
    press('c')
    expect(screen.getByTestId('calibration-grid')).toBeTruthy()
    press('g')
    expect(isGulping()).toBe(false)
  })

  it('ignores G with a modifier', async () => {
    await boot('/projection?layout=rabbit-hole')
    press('g', { ctrlKey: true })
    press('g', { metaKey: true })
    expect(isGulping()).toBe(false)
  })
})

describe('the standard layout', () => {
  it('does nothing on G', async () => {
    await boot('/projection')
    expect(screen.getAllByText('Noble Coffee').length).toBeGreaterThan(0)
    press('g')
    await advance(3000)
    expect(screen.queryByTestId('rabbit-hole-stage')).toBeNull()
    expect(document.querySelector('.gulping')).toBeNull()
  })
})
