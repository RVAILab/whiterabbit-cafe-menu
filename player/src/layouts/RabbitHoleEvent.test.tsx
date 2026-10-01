// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { UpcomingWidget } from '../components/UpcomingWidget'
import { HOLE_VARIANTS, type HoleVariant, type HoleVariantId } from '../rabbitHole/holeVariants'
import { sampleProjectedMenu } from '../test/fixtures/sampleProjectedMenu'
import {
  displayControlV1,
  renderProjection,
  rovaEvents,
  stubLocalStorage,
  stubProjectionServer,
  type ProjectionServer,
} from '../test/projectionHarness'

/** Tomorrow at 6:00 PM local time, as Rova sends it. */
function tomorrowAtSix(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(18, 0, 0, 0)
  return d.toISOString()
}

let server: ProjectionServer

beforeEach(() => {
  stubLocalStorage()
  vi.stubEnv('VITE_ROVA_API_KEY', 'test-rova-key')
  server = {
    projectedMenu: structuredClone(sampleProjectedMenu),
    displayControl: displayControlV1(),
    rovaEvents: rovaEvents({ title: 'RVAI Lab', startsAt: tomorrowAtSix() }),
  }
  stubProjectionServer(server)
  // jsdom has no canvas; the hole background is not under test here.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

const holeEvent = () => screen.findByTestId('rh-hole-event')

describe('the next event at the bottom of the rabbit hole', () => {
  it('shows the variant label, the event title and the relative time', async () => {
    const fetchMock = stubProjectionServer(server)
    renderProjection('/projection?layout=rabbit-hole')

    const block = await holeEvent()
    expect(block.closest('[data-testid="rabbit-hole-layer-hole-event"]')).toBeTruthy()
    expect(block.classList.contains('rh-hole-event')).toBe(true)
    await vi.waitFor(() => expect(within(block).getByText('RVAI Lab')).toBeTruthy())
    expect(within(block).getByText('Next down the hole')).toBeTruthy()
    expect(within(block).getByText('Tomorrow · 6:00 PM')).toBeTruthy()
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('rova.live'))).toBe(true)
  })

  it('is centered on the variant hole center', async () => {
    renderProjection('/projection?layout=rabbit-hole')

    const block = await holeEvent()
    expect(block.style.left).toBe('300px')
    expect(block.style.top).toBe('520px')
  })

  it('falls back to "White Rabbit / We\'re all mad here" with no upcoming event', async () => {
    server.rovaEvents = rovaEvents()
    const fetchMock = stubProjectionServer(server)
    renderProjection('/projection?layout=rabbit-hole')

    const block = await holeEvent()
    await vi.waitFor(() =>
      expect(fetchMock.mock.calls.some(([url]) => String(url).includes('rova.live'))).toBe(true),
    )
    expect(within(block).getByText('White Rabbit')).toBeTruthy()
    expect(within(block).getByText("We're all mad here")).toBeTruthy()
    expect(within(block).queryByText('Next down the hole')).toBeNull()
  })

  it('falls back when Rova is unreachable', async () => {
    server.rovaEvents = undefined
    renderProjection('/projection?layout=rabbit-hole')

    const block = await holeEvent()
    expect(within(block).getByText("We're all mad here")).toBeTruthy()
  })

  describe('with another registered variant', () => {
    const id = 'vortex' as HoleVariantId
    let original: HoleVariant | undefined

    beforeEach(() => {
      original = HOLE_VARIANTS[id]
      HOLE_VARIANTS[id] = {
        id,
        label: 'Vortex',
        holeCenter: [320, 500],
        eventLabel: 'Get sucked into',
        draw: () => {},
      }
    })

    afterEach(() => {
      if (original) HOLE_VARIANTS[id] = original
      else delete (HOLE_VARIANTS as Partial<Record<HoleVariantId, HoleVariant>>)[id]
    })

    it('takes its label and center from the active variant', async () => {
      renderProjection('/projection?layout=rabbit-hole&variant=vortex')

      const block = await holeEvent()
      await vi.waitFor(() => expect(within(block).getByText('RVAI Lab')).toBeTruthy())
      expect(within(block).getByText('Get sucked into')).toBeTruthy()
      expect(block.style.left).toBe('320px')
      expect(block.style.top).toBe('500px')
    })
  })
})

describe('the standard layout', () => {
  it('has no hole event', async () => {
    renderProjection('/projection')
    expect(await screen.findByText('Noble Coffee')).toBeTruthy()
    expect(screen.queryByTestId('rh-hole-event')).toBeNull()
  })

  it('keeps the Upcoming card format ("Tomorrow at 6:00 PM")', async () => {
    render(<UpcomingWidget visible />)
    expect(await screen.findByText('RVAI Lab')).toBeTruthy()
    expect(screen.getByText('Tomorrow at 6:00 PM')).toBeTruthy()
  })
})
