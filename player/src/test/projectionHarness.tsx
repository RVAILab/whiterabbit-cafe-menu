import { act, render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import App from '../App'

/**
 * Route-level harness for `/projection`: the whole App behind a MemoryRouter,
 * with `fetch` answering the two polled endpoints from mutable state, so a
 * test can change what the server says between polls.
 */
export interface ProjectionServer {
  projectedMenu: unknown
  displayControl: unknown
  /** Rova public events response; absent means Rova answers 404 (no event). */
  rovaEvents?: unknown
}

export function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    json: async () => body,
  } as Response
}

export function displayControlV1(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    revision: 1,
    updatedAt: '2026-09-30T16:00:00.000Z',
    desired: { overlay: 'none', visualization: 'none', visualizationMode: 'background' },
    screenCommand: null,
    ...overrides,
  }
}

/** A valid v2 snapshot (standard layout, no extras); `desired` overrides merge into its desired. */
export function displayControlV2(
  { desired, ...overrides }: { desired?: Record<string, unknown> } & Record<string, unknown> = {},
) {
  return {
    schemaVersion: 2,
    revision: 1,
    updatedAt: '2026-09-30T16:00:00.000Z',
    desired: {
      overlay: 'none',
      visualization: 'none',
      visualizationMode: 'background',
      layout: 'standard',
      rabbitHole: {
        variant: 'dive',
        speed: 0.4,
        gulp: { enabled: true, intervalMinutes: 15, onMenuChange: true },
      },
      ...desired,
    },
    screenCommand: null,
    effectCommand: null,
    calibration: null,
    ...overrides,
  }
}

export function stubProjectionServer(server: ProjectionServer) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('projected-menu')) return jsonResponse(server.projectedMenu)
    if (url.includes('display-control')) return jsonResponse(server.displayControl)
    if (url.includes('rova.live') && server.rovaEvents !== undefined) return jsonResponse(server.rovaEvents)
    return jsonResponse(null, 404)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

/** A Rova `/api/public/events` response holding these instances. */
export function rovaEvents(...instances: { title: string; startsAt: string }[]) {
  return {
    events: instances.map((_, i) => ({ id: `event-${i}` })),
    instances: instances.map((instance, i) => ({ ...instance, eventId: `event-${i}` })),
  }
}

export function stubLocalStorage() {
  const values = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    get length() { return values.size },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => [...values.keys()][index] ?? null,
    removeItem: (key: string) => { values.delete(key) },
    setItem: (key: string, value: string) => { values.set(key, String(value)) },
  } satisfies Storage)
  return values
}

export function renderProjection(path = '/projection') {
  return render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>)
}

/**
 * Fake the clock (timeouts, intervals, Date) but not animation frames, which
 * route tests that care about them stub and step by hand. Pair with
 * `advance` / `bootProjection` instead of `findBy*` (which polls on real time).
 */
export function fakeProjectionTimers() {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] })
}

/**
 * Advance the fake clock by `ms`, flushing the fetches and renders it sets off.
 * Steps one display-control poll (2s) per act: React flushes renders when an
 * act exits, so one long act would apply poll results only at its end.
 */
export async function advance(ms: number) {
  let left = ms
  do {
    const step = Math.min(left, 2_000)
    await act(async () => { await vi.advanceTimersByTimeAsync(step) })
    left -= step
  } while (left > 0)
}

/** Render `path` and let the first polls (menu, display control, Rova) land and the layout settle. */
export async function bootProjection(path = '/projection') {
  const view = renderProjection(path)
  for (let i = 0; i < 5; i++) await advance(0)
  return view
}
