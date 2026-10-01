import { render } from '@testing-library/react'
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
    return jsonResponse(null, 404)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
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
