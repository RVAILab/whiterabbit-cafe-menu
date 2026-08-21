// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DISPLAY_CONTROL_STORAGE_KEY,
  DISPLAY_SCREEN_COMMAND_STORAGE_KEY,
  useDisplayControl,
} from './useDisplayControl'

const handlers = vi.hoisted(() => ({
  setSleepMode: vi.fn(),
  setClosedMode: vi.fn(),
  setVisualization: vi.fn(),
  setFullscreen: vi.fn(),
  showScreen: vi.fn(),
  returnToPrimary: vi.fn(),
  keyMap: { A: { _id: 'screen-a', title: 'Screen A', triggerKey: 'A' } },
}))

vi.mock('../context/SleepModeContext', () => ({
  useSleepMode: () => ({
    setSleepMode: handlers.setSleepMode,
    setClosedMode: handlers.setClosedMode,
  }),
}))
vi.mock('../context/VisualizationContext', () => ({
  useVisualization: () => ({
    setVisualization: handlers.setVisualization,
    setFullscreen: handlers.setFullscreen,
  }),
}))
vi.mock('../context/ScreenContext', () => ({
  useScreenContext: () => ({
    showScreen: handlers.showScreen,
    returnToPrimary: handlers.returnToPrimary,
    keyMap: handlers.keyMap,
  }),
}))

const snapshot = (revision: number, overrides: Record<string, unknown> = {}) => ({
  schemaVersion: 1,
  revision,
  updatedAt: '2026-08-12T18:00:00.000Z',
  desired: {
    overlay: 'sleep',
    visualization: 'bubbles',
    visualizationMode: 'fullscreen',
  },
  screenCommand: null,
  ...overrides,
})

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

function Harness({ interval = 2_000 }: { interval?: number }) {
  useDisplayControl('/display-control', interval)
  return null
}

const flushRequest = async () => {
  await act(async () => { await Promise.resolve() })
}

beforeEach(() => {
  vi.useFakeTimers()
  Object.values(handlers).forEach((value) => {
    if (typeof value === 'function' && 'mockClear' in value) value.mockClear()
  })
  const values = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    get length() { return values.size },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => [...values.keys()][index] ?? null,
    removeItem: (key: string) => { values.delete(key) },
    setItem: (key: string, value: string) => { values.set(key, String(value)) },
  } satisfies Storage)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('useDisplayControl', () => {
  it('fetches immediately, applies desired state, then polls non-overlapping with ETag', async () => {
    let resolveFirst!: (value: Response) => void
    const firstRequest = new Promise<Response>((resolve) => { resolveFirst = resolve })
    const fetchMock = vi.fn()
      .mockReturnValueOnce(firstRequest)
      .mockResolvedValueOnce(response(null, { status: 304 }))
    vi.stubGlobal('fetch', fetchMock)

    render(<Harness interval={1_000} />)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await act(async () => vi.advanceTimersByTimeAsync(3_000))
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await act(async () => resolveFirst(response(snapshot(1), { etag: '"control-1"' })))
    expect(handlers.setSleepMode).toHaveBeenCalledWith(true)
    expect(handlers.setVisualization).toHaveBeenCalledWith('bubbles')
    expect(handlers.setFullscreen).toHaveBeenCalledWith(true)

    await act(async () => vi.advanceTimersByTimeAsync(1_000))
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1]?.[1]).toEqual(expect.objectContaining({
      cache: 'no-store',
      headers: { 'If-None-Match': '"control-1"' },
    }))
  })

  it('retains state through malformed responses and outages, then recovers', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(snapshot(1)))
      .mockResolvedValueOnce(response({ ...snapshot(2), desired: 'partial' }))
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValueOnce(response(snapshot(4, {
        desired: { overlay: 'closed', visualization: 'waveforms', visualizationMode: 'background' },
      })))
    vi.stubGlobal('fetch', fetchMock)

    render(<Harness interval={1_000} />)
    await flushRequest()
    expect(handlers.setSleepMode).toHaveBeenCalledTimes(1)

    await act(async () => vi.advanceTimersByTimeAsync(1_000))
    await act(async () => vi.advanceTimersByTimeAsync(1_000))
    expect(handlers.setSleepMode).toHaveBeenCalledTimes(1)

    await act(async () => vi.advanceTimersByTimeAsync(1_000))
    expect(handlers.setClosedMode).toHaveBeenCalledWith(true)
    expect(handlers.setVisualization).toHaveBeenLastCalledWith('waveforms')
    expect(handlers.setFullscreen).toHaveBeenLastCalledWith(false)
  })

  it('ignores stale and equal revisions', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(snapshot(5)))
      .mockResolvedValueOnce(response(snapshot(5, {
        desired: { overlay: 'closed', visualization: 'geometric', visualizationMode: 'background' },
      })))
      .mockResolvedValueOnce(response(snapshot(4, {
        desired: { overlay: 'closed', visualization: 'geometric', visualizationMode: 'background' },
      })))
    vi.stubGlobal('fetch', fetchMock)

    render(<Harness interval={1_000} />)
    await flushRequest()
    await act(async () => vi.advanceTimersByTimeAsync(2_000))

    expect(handlers.setSleepMode).toHaveBeenCalledTimes(1)
    expect(handlers.setClosedMode).not.toHaveBeenCalled()
    expect(handlers.setVisualization).toHaveBeenCalledTimes(1)
  })

  it('retries immediately on online and visibility events', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValueOnce(response(snapshot(1)))
      .mockResolvedValueOnce(response(snapshot(2)))
    vi.stubGlobal('fetch', fetchMock)

    render(<Harness interval={60_000} />)
    await flushRequest()
    await act(async () => window.dispatchEvent(new Event('online')))
    expect(fetchMock).toHaveBeenCalledTimes(2)

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    await act(async () => document.dispatchEvent(new Event('visibilitychange')))
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('applies each screen command once and does not replay it after restart', async () => {
    const command = {
      id: 'screen-command-1',
      value: 'a',
      issuedAt: '2026-08-12T18:00:00.000Z',
    }
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(snapshot(1, { screenCommand: command })))
      .mockResolvedValueOnce(response(snapshot(2, { screenCommand: command })))
      .mockResolvedValueOnce(response(snapshot(3, { screenCommand: command })))
    vi.stubGlobal('fetch', fetchMock)

    const first = render(<Harness interval={1_000} />)
    await flushRequest()
    expect(handlers.showScreen).toHaveBeenCalledTimes(1)
    expect(handlers.showScreen).toHaveBeenCalledWith(handlers.keyMap.A)
    expect(localStorage.getItem(DISPLAY_SCREEN_COMMAND_STORAGE_KEY)).toBe(command.id)

    await act(async () => vi.advanceTimersByTimeAsync(1_000))
    expect(handlers.showScreen).toHaveBeenCalledTimes(1)
    first.unmount()
    render(<Harness interval={1_000} />)
    await flushRequest()
    expect(handlers.showScreen).toHaveBeenCalledTimes(1)
  })

  it('persists a validated snapshot and restores desired state and ETag on restart', async () => {
    const cachedSnapshot = snapshot(7, {
      desired: { overlay: 'closed', visualization: 'geometric', visualizationMode: 'background' },
      screenCommand: {
        id: 'already-received',
        value: 'a',
        issuedAt: '2026-08-12T18:00:00.000Z',
      },
    })
    localStorage.setItem(DISPLAY_CONTROL_STORAGE_KEY, JSON.stringify({
      snapshot: cachedSnapshot,
      etag: '"control-7"',
    }))
    const fetchMock = vi.fn().mockResolvedValue(response(null, { status: 304 }))
    vi.stubGlobal('fetch', fetchMock)

    render(<Harness />)

    expect(handlers.setClosedMode).toHaveBeenCalledWith(true)
    expect(handlers.setVisualization).toHaveBeenCalledWith('geometric')
    expect(handlers.setFullscreen).toHaveBeenCalledWith(false)
    expect(handlers.showScreen).not.toHaveBeenCalled()
    await flushRequest()
    expect(fetchMock).toHaveBeenCalledWith('/display-control', expect.objectContaining({
      headers: { 'If-None-Match': '"control-7"' },
    }))
  })

  it('persists new validated snapshots but never replays their screen command from cache', async () => {
    const command = {
      id: 'screen-command-cached',
      value: 'a',
      issuedAt: '2026-08-12T18:00:00.000Z',
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      response(snapshot(3, { screenCommand: command }), { etag: '"control-3"' }),
    ))

    const first = render(<Harness />)
    await flushRequest()
    expect(JSON.parse(localStorage.getItem(DISPLAY_CONTROL_STORAGE_KEY)!)).toEqual({
      snapshot: snapshot(3, { screenCommand: command }),
      etag: '"control-3"',
    })
    expect(handlers.showScreen).toHaveBeenCalledTimes(1)

    first.unmount()
    handlers.showScreen.mockClear()
    render(<Harness />)
    expect(handlers.showScreen).not.toHaveBeenCalled()
    await flushRequest()
    expect(handlers.showScreen).not.toHaveBeenCalled()
  })

  it('removes corrupt cached control state without applying it', () => {
    localStorage.setItem(DISPLAY_CONTROL_STORAGE_KEY, JSON.stringify({
      snapshot: { ...snapshot(2), desired: { overlay: 'invalid' } },
      etag: '"bad"',
    }))
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))

    render(<Harness />)

    expect(localStorage.getItem(DISPLAY_CONTROL_STORAGE_KEY)).toBeNull()
    expect(handlers.setSleepMode).not.toHaveBeenCalled()
    expect(handlers.setClosedMode).not.toHaveBeenCalled()
    expect(handlers.setVisualization).not.toHaveBeenCalled()
  })
})
