// @vitest-environment jsdom
import { act, cleanup, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { DISPLAY_CONTROL_STORAGE_KEY } from '../hooks/useDisplayControl'
import { sampleProjectedMenu } from '../test/fixtures/sampleProjectedMenu'
import {
  displayControlV1,
  displayControlV2,
  renderProjection,
  stubLocalStorage,
  stubProjectionServer,
  type ProjectionServer,
} from '../test/projectionHarness'

let server: ProjectionServer
let fetchMock: Mock
let storage: Map<string, string>

beforeEach(() => {
  storage = stubLocalStorage()
  server = { projectedMenu: structuredClone(sampleProjectedMenu), displayControl: displayControlV1() }
  fetchMock = stubProjectionServer(server)
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const displayControlRequests = () =>
  fetchMock.mock.calls.map(([url]) => String(url)).filter((url) => url.includes('display-control'))

/** Wait until the first display-control response has been received and handled. */
async function settleDisplayControl() {
  await vi.waitFor(() => expect(displayControlRequests().length).toBeGreaterThan(0))
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
}

const rabbitHoleV2 = (overrides: Record<string, unknown> = {}) =>
  displayControlV2({ desired: { layout: 'rabbit-hole' }, ...overrides })

const cache = (snapshot: unknown, etag: string | null = null) =>
  storage.set(DISPLAY_CONTROL_STORAGE_KEY, JSON.stringify({ snapshot, etag }))

const expectStandardBoard = async () => {
  expect(await screen.findByText('Noble Coffee')).toBeTruthy()
  expect(screen.queryByTestId('rabbit-hole-stage')).toBeNull()
}

describe('/projection driven by display control', () => {
  it('requests display control schema v2', async () => {
    renderProjection('/projection')
    await settleDisplayControl()

    expect(displayControlRequests()[0]).toMatch(/[?&]schemaVersion=2(&|$)/)
  })

  it('renders the standard board for a v1 snapshot', async () => {
    renderProjection('/projection')
    await settleDisplayControl()

    await expectStandardBoard()
  })

  it('renders the standard board for a v2 standard layout', async () => {
    server.displayControl = displayControlV2()
    renderProjection('/projection')
    await settleDisplayControl()

    await expectStandardBoard()
  })

  it('renders the rabbit hole for v2 layout: rabbit-hole', async () => {
    server.displayControl = rabbitHoleV2()
    renderProjection('/projection')

    expect(await screen.findByTestId('rabbit-hole-stage')).toBeTruthy()
    expect(screen.getAllByText('Noble Coffee')).toHaveLength(1)
  })

  it('lets the URL override win over v2', async () => {
    server.displayControl = rabbitHoleV2()
    renderProjection('/projection?layout=standard')
    await settleDisplayControl()

    await expectStandardBoard()
  })

  it('ignores desired.visualization in the rabbit hole layout', async () => {
    server.displayControl = rabbitHoleV2({
      desired: { layout: 'rabbit-hole', visualization: 'bubbles', visualizationMode: 'fullscreen' },
    })
    renderProjection('/projection')

    const stage = await screen.findByTestId('rabbit-hole-stage')
    await settleDisplayControl()
    // The standard visualization layer draws on a canvas outside the stage.
    const strayCanvases = [...document.querySelectorAll('canvas')].filter((c) => !stage.contains(c))
    expect(strayCanvases).toEqual([])
  })

  it('rejects a v2 snapshot with an extra key and keeps the display', async () => {
    server.displayControl = { ...rabbitHoleV2(), extra: true }
    renderProjection('/projection')
    await settleDisplayControl()

    await expectStandardBoard()
  })

  it('rejects a malformed v2 snapshot without leaving the cached rabbit hole', async () => {
    cache(rabbitHoleV2({ revision: 4 }))
    server.displayControl = displayControlV2({ revision: 5, desired: {
      layout: 'standard',
      rabbitHole: { variant: 'dive', speed: 9, gulp: { enabled: false, intervalMinutes: 15, onMenuChange: false } },
    } })
    renderProjection('/projection')
    await settleDisplayControl()

    expect(screen.getByTestId('rabbit-hole-stage')).toBeTruthy()
  })

  it('restores a cached v2 snapshot on restart', async () => {
    cache(rabbitHoleV2({ revision: 9 }))
    server.displayControl = displayControlV1({ revision: 2 })
    renderProjection('/projection')

    expect(await screen.findByTestId('rabbit-hole-stage')).toBeTruthy()
    await settleDisplayControl()
    expect(screen.getByTestId('rabbit-hole-stage')).toBeTruthy()
  })

  it('restores a cached v1 snapshot on restart', async () => {
    cache(displayControlV1({
      revision: 9,
      desired: { overlay: 'closed', visualization: 'none', visualizationMode: 'background' },
    }))
    server.displayControl = displayControlV1({ revision: 2 })
    renderProjection('/projection')

    expect(await screen.findByText(/closed for today/)).toBeTruthy()
    await expectStandardBoard()
  })

  it('switches back to the standard board when a newer v1 snapshot arrives', async () => {
    cache(rabbitHoleV2({ revision: 3 }))
    server.displayControl = displayControlV1({ revision: 4 })
    renderProjection('/projection')
    await settleDisplayControl()

    await vi.waitFor(() => expect(screen.queryByTestId('rabbit-hole-stage')).toBeNull())
    await expectStandardBoard()
  })
})
