// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react'
import { useEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DisplayControlExtras } from '../lib/displayControl'
import {
  DISPLAY_CONTROL_STORAGE_KEY,
  DISPLAY_SCREEN_COMMAND_STORAGE_KEY,
  useDisplayControl,
  withSchemaVersion,
} from './useDisplayControl'

const handlers = vi.hoisted(() => ({
  setSleepMode: vi.fn(),
  setClosedMode: vi.fn(),
  setMassageMode: vi.fn(),
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
    setMassageMode: handlers.setMassageMode,
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

const captured: { extras: DisplayControlExtras | null } = { extras: null }

function Harness({ interval = 2_000 }: { interval?: number }) {
  const extras = useDisplayControl('/display-control', interval)
  useEffect(() => { captured.extras = extras })
  return null
}

const snapshotV2 = (revision: number, overrides: Record<string, unknown> = {}) => ({
  schemaVersion: 2,
  revision,
  updatedAt: '2026-09-30T18:00:00.000Z',
  desired: {
    overlay: 'none',
    visualization: 'bubbles',
    visualizationMode: 'background',
    layout: 'rabbit-hole',
    rabbitHole: {
      variant: 'vortex',
      speed: 0.5,
      gulp: { enabled: true, intervalMinutes: 10, onMenuChange: false },
    },
  },
  screenCommand: null,
  effectCommand: { id: 'gulp-1', value: 'gulp', issuedAt: '2026-09-30T17:59:59.000Z' },
  calibration: {
    version: 1,
    corners: [[0, 0], [1, 0], [1, 1], [0, 1]],
    updatedAt: '2026-09-29T12:00:00.000Z',
  },
  ...overrides,
})

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

  it('applies the massage overlay from a snapshot', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(response(snapshot(3, {
      desired: { overlay: 'massage', visualization: 'none', visualizationMode: 'background' },
    })))
    vi.stubGlobal('fetch', fetchMock)

    render(<Harness interval={0} />)
    await flushRequest()

    expect(handlers.setMassageMode).toHaveBeenCalledWith(true)
    expect(handlers.setSleepMode).not.toHaveBeenCalled()
    expect(handlers.setClosedMode).not.toHaveBeenCalled()
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
    expect(fetchMock).toHaveBeenCalledWith('/display-control?schemaVersion=2', expect.objectContaining({
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

  it('asks for schema v2, keeping any existing query string', () => {
    expect(withSchemaVersion('/display-control')).toBe('/display-control?schemaVersion=2')
    expect(withSchemaVersion('https://pos.example/api/display-control?screen=wall'))
      .toBe('https://pos.example/api/display-control?screen=wall&schemaVersion=2')
  })

  it('returns standard-layout extras for v1 and the parsed extras for v2', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(snapshot(1)))
      .mockResolvedValueOnce(response(snapshotV2(2)))
    vi.stubGlobal('fetch', fetchMock)

    render(<Harness interval={1_000} />)
    expect(captured.extras).toEqual({ layout: 'standard', rabbitHole: null, effectCommand: null, calibration: null })
    await flushRequest()
    expect(captured.extras?.layout).toBe('standard')

    await act(async () => vi.advanceTimersByTimeAsync(1_000))
    const v2 = snapshotV2(2)
    expect(captured.extras).toEqual({
      layout: 'rabbit-hole',
      rabbitHole: v2.desired.rabbitHole,
      effectCommand: v2.effectCommand,
      calibration: v2.calibration,
    })
    // v2 still drives the existing overlay and visualization contexts.
    expect(handlers.setSleepMode).toHaveBeenLastCalledWith(false)
    expect(handlers.setVisualization).toHaveBeenLastCalledWith('bubbles')
  })

  it('restores a cached v2 snapshot, but never its effect command, and keeps the ETag', async () => {
    localStorage.setItem(DISPLAY_CONTROL_STORAGE_KEY, JSON.stringify({
      snapshot: snapshotV2(5),
      etag: '"control-5"',
    }))
    const fetchMock = vi.fn().mockResolvedValue(response(null, { status: 304 }))
    vi.stubGlobal('fetch', fetchMock)

    render(<Harness />)
    expect(captured.extras?.layout).toBe('rabbit-hole')
    expect(captured.extras?.rabbitHole?.variant).toBe('vortex')
    expect(captured.extras?.calibration).toEqual(snapshotV2(5).calibration)
    expect(captured.extras?.effectCommand).toBeNull()

    await flushRequest()
    expect(fetchMock).toHaveBeenCalledWith('/display-control?schemaVersion=2', expect.objectContaining({
      headers: { 'If-None-Match': '"control-5"' },
    }))
    expect(captured.extras?.layout).toBe('rabbit-hole')
  })

  it('persists a validated v2 snapshot as received', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(snapshotV2(3), { etag: '"control-3"' })))

    render(<Harness />)
    await flushRequest()

    expect(JSON.parse(localStorage.getItem(DISPLAY_CONTROL_STORAGE_KEY)!)).toEqual({
      snapshot: snapshotV2(3),
      etag: '"control-3"',
    })
  })

  it('rejects a v2 snapshot with an extra key without changing state', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(snapshotV2(1)))
      .mockResolvedValueOnce(response({ ...snapshotV2(2, { desired: { ...snapshotV2(2).desired, layout: 'standard' } }), extra: 1 }))
    vi.stubGlobal('fetch', fetchMock)

    render(<Harness interval={1_000} />)
    await flushRequest()
    const calls = handlers.setVisualization.mock.calls.length
    await act(async () => vi.advanceTimersByTimeAsync(1_000))

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(captured.extras?.layout).toBe('rabbit-hole')
    expect(handlers.setVisualization).toHaveBeenCalledTimes(calls)
  })
})
