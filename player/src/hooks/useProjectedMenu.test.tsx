// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import { useEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  PROJECTED_MENU_STORAGE_KEY,
  useProjectedMenu,
  type ProjectedMenuState,
} from './useProjectedMenu'
import { PROJECTED_MENU_SECTIONS } from '../lib/projectedMenu'

const projectedDocument = {
  schemaVersion: 1,
  generatedAt: '2026-08-12T18:00:00.000Z',
  availabilityRevision: 'a'.repeat(43),
  sections: PROJECTED_MENU_SECTIONS.map((section) => ({
    id: section.id,
    name: section.name,
    items: section.id === 'noble-coffee'
      ? [{
          id: 'template-1',
          templateId: 1,
          name: 'Espresso',
          basePrice: 4,
          stockStatus: 'available',
          variants: [],
        }]
      : [],
  })),
}

const newerDocument = {
  ...projectedDocument,
  generatedAt: '2026-08-12T18:01:00.000Z',
}

function response(
  body: unknown,
  { etag = null, status = 200 }: { etag?: string | null; status?: number } = {},
) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(etag ? { ETag: etag } : undefined),
    json: async () => body,
  } as Response
}

let latestState: ProjectedMenuState

function Harness({ interval }: { interval?: number }) {
  const state = useProjectedMenu('/projected-menu', interval)
  useEffect(() => {
    latestState = state
  }, [state])
  return <div>{state.document?.generatedAt ?? state.error ?? 'loading'}</div>
}

const flushRequest = async () => {
  await act(async () => { await Promise.resolve() })
}

beforeEach(() => {
  vi.useFakeTimers()
  const values = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    get length() { return values.size },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => [...values.keys()][index] ?? null,
    removeItem: (key: string) => { values.delete(key) },
    setItem: (key: string, value: string) => { values.set(key, String(value)) },
  } satisfies Storage)
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('useProjectedMenu', () => {
  it('fetches immediately, validates the response, and persists the document and ETag', async () => {
    const fetchMock = vi.fn(async () => response(projectedDocument, { etag: '"menu-1"' }))
    vi.stubGlobal('fetch', fetchMock)

    render(<Harness />)
    await flushRequest()

    expect(screen.getByText(projectedDocument.generatedAt)).toBeTruthy()
    expect(fetchMock).toHaveBeenCalledWith('/projected-menu', expect.objectContaining({
      cache: 'no-store',
      headers: {},
    }))
    expect(JSON.parse(localStorage.getItem(PROJECTED_MENU_STORAGE_KEY)!)).toEqual({
      document: projectedDocument,
      etag: '"menu-1"',
    })
  })

  it('restores a validated menu synchronously and uses its ETag for a 304 request', async () => {
    localStorage.setItem(PROJECTED_MENU_STORAGE_KEY, JSON.stringify({
      document: projectedDocument,
      etag: '"menu-1"',
    }))
    const fetchMock = vi.fn(async () => response(null, { status: 304 }))
    vi.stubGlobal('fetch', fetchMock)

    render(<Harness />)

    expect(screen.getByText(projectedDocument.generatedAt)).toBeTruthy()
    expect(latestState.isLoading).toBe(false)
    await flushRequest()
    expect(fetchMock).toHaveBeenCalledWith('/projected-menu', expect.objectContaining({
      headers: { 'If-None-Match': '"menu-1"' },
    }))
    expect(latestState.error).toBeNull()
  })

  it('discards an invalid persisted document before fetching', async () => {
    localStorage.setItem(PROJECTED_MENU_STORAGE_KEY, JSON.stringify({
      document: { ...projectedDocument, schemaVersion: 2 },
      etag: '"bad"',
    }))
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))

    render(<Harness />)

    expect(screen.getByText('loading')).toBeTruthy()
    expect(latestState.document).toBeNull()
    expect(localStorage.getItem(PROJECTED_MENU_STORAGE_KEY)).toBeNull()
  })

  it('polls after the preceding request completes and sends If-None-Match', async () => {
    let resolveFirst!: (value: Response) => void
    const firstRequest = new Promise<Response>((resolve) => { resolveFirst = resolve })
    const fetchMock = vi
      .fn()
      .mockReturnValueOnce(firstRequest)
      .mockResolvedValueOnce(response(null, { status: 304 }))
    vi.stubGlobal('fetch', fetchMock)

    render(<Harness interval={1000} />)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await act(async () => vi.advanceTimersByTimeAsync(5_000))
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await act(async () => { resolveFirst(response(projectedDocument, { etag: '"menu-1"' })) })
    await act(async () => vi.advanceTimersByTimeAsync(999))
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await act(async () => vi.advanceTimersByTimeAsync(1))
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1]?.[1]).toEqual(expect.objectContaining({
      headers: { 'If-None-Match': '"menu-1"' },
    }))
  })

  it('uses a 20-second default polling interval', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(projectedDocument, { etag: '"menu-1"' }))
      .mockResolvedValueOnce(response(null, { status: 304 }))
    vi.stubGlobal('fetch', fetchMock)

    render(<Harness />)
    await flushRequest()
    await act(async () => vi.advanceTimersByTimeAsync(19_999))
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await act(async () => vi.advanceTimersByTimeAsync(1))
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('keeps the last valid document and cache after a malformed response', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(projectedDocument, { etag: '"menu-1"' }))
      .mockResolvedValueOnce(response({ ...newerDocument, sections: 'partial' }, { etag: '"bad"' }))
    vi.stubGlobal('fetch', fetchMock)

    render(<Harness interval={1000} />)
    await flushRequest()
    await act(async () => vi.advanceTimersByTimeAsync(1000))

    expect(screen.getByText(projectedDocument.generatedAt)).toBeTruthy()
    expect(latestState.error).toMatch(/schema version 1/)
    expect(JSON.parse(localStorage.getItem(PROJECTED_MENU_STORAGE_KEY)!)).toEqual({
      document: projectedDocument,
      etag: '"menu-1"',
    })
  })

  it('keeps the last valid document and cache when a response has no menu items', async () => {
    const emptyDocument = {
      ...newerDocument,
      sections: PROJECTED_MENU_SECTIONS.map(({ id, name }) => ({ id, name, items: [] })),
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(projectedDocument, { etag: '"menu-1"' }))
      .mockResolvedValueOnce(response(emptyDocument, { etag: '"empty"' }))
    vi.stubGlobal('fetch', fetchMock)

    render(<Harness interval={1000} />)
    await flushRequest()
    await act(async () => vi.advanceTimersByTimeAsync(1000))

    expect(latestState.document).toEqual(projectedDocument)
    expect(latestState.error).toMatch(/schema version 1/)
    expect(latestState.isDisplayLive()).toBe(false)
    expect(JSON.parse(localStorage.getItem(PROJECTED_MENU_STORAGE_KEY)!)).toEqual({
      document: projectedDocument,
      etag: '"menu-1"',
    })
  })

  it('keeps stale content during an outage and recovers on a later poll without reload', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(projectedDocument, { etag: '"menu-1"' }))
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValueOnce(response(newerDocument, { etag: '"menu-2"' }))
    vi.stubGlobal('fetch', fetchMock)

    render(<Harness interval={1000} />)
    await flushRequest()

    await act(async () => vi.advanceTimersByTimeAsync(1000))
    expect(screen.getByText(projectedDocument.generatedAt)).toBeTruthy()
    expect(latestState.error).toBe('offline')

    await act(async () => vi.advanceTimersByTimeAsync(1000))
    expect(screen.getByText(newerDocument.generatedAt)).toBeTruthy()
    expect(latestState.error).toBeNull()
  })

  it('exposes an actionable error when no valid document has ever loaded', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))

    render(<Harness />)
    await flushRequest()

    expect(latestState.document).toBeNull()
    expect(latestState.isLoading).toBe(false)
    expect(latestState.error).toBe('offline')
    expect(latestState.isDisplayLive()).toBe(false)
  })

  it('retries immediately when the browser comes online', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValueOnce(response(projectedDocument))
    vi.stubGlobal('fetch', fetchMock)

    render(<Harness interval={60_000} />)
    await flushRequest()
    await act(async () => window.dispatchEvent(new Event('online')))

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(screen.getByText(projectedDocument.generatedAt)).toBeTruthy()
    expect(latestState.isDisplayLive()).toBe(true)
  })

  it('reports cached content as unhealthy after the latest refresh fails', async () => {
    localStorage.setItem(PROJECTED_MENU_STORAGE_KEY, JSON.stringify({
      document: projectedDocument,
      etag: '"menu-1"',
    }))
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))

    render(<Harness />)
    expect(latestState.isDisplayLive()).toBe(true)
    await flushRequest()

    expect(latestState.document).toEqual(projectedDocument)
    expect(latestState.isDisplayLive()).toBe(false)
  })
})
