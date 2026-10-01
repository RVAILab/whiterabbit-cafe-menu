// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sampleProjectedMenu } from '../test/fixtures/sampleProjectedMenu'
import {
  displayControlV1,
  displayControlV2,
  renderProjection,
  stubLocalStorage,
  stubProjectionServer,
  type ProjectionServer,
} from '../test/projectionHarness'
import { DISPLAY_CONTROL_STORAGE_KEY } from '../hooks/useDisplayControl'
import { DISPLAY_EFFECT_COMMAND_STORAGE_KEY } from '../rabbitHole/useRemoteGulp'

/* Scheduled and remote gulps at the route seam, under fake timers. */

const MINUTE = 60_000
const POLL_MS = 2_000
// Each simulated 15 minutes is ~450 display-control polls.
vi.setConfig({ testTimeout: 30_000 })

let server: ProjectionServer
let storage: Map<string, string>
let revision: number

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

/** A v2 rabbit-hole snapshot with these gulp settings, at the next revision. */
function rabbitHole(
  gulp: { enabled?: boolean; intervalMinutes?: number } = {},
  overrides: Record<string, unknown> = {},
) {
  revision += 1
  return displayControlV2({
    revision,
    desired: {
      layout: 'rabbit-hole',
      rabbitHole: {
        variant: 'dive',
        speed: 0.4,
        gulp: { enabled: true, intervalMinutes: 15, onMenuChange: true, ...gulp },
      },
    },
    ...overrides,
  })
}

const effect = (id: string, issuedAgoMs = 0) => ({
  effectCommand: { id, value: 'gulp', issuedAt: new Date(Date.now() - issuedAgoMs).toISOString() },
})

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-01T16:00:00.000Z'))
  revision = 0
  storage = stubLocalStorage()
  server = { projectedMenu: structuredClone(sampleProjectedMenu), displayControl: rabbitHole() }
  stubProjectionServer(server)
  stubBrowser()
  // Jitter in the middle: exactly intervalMinutes.
  vi.spyOn(Math, 'random').mockReturnValue(0.5)
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

/**
 * Advance in acts of at most one poll: React flushes renders when an act exits, so
 * one long act would only apply display-control changes at its end.
 */
const advance = async (ms: number) => {
  let left = ms
  do {
    const step = Math.min(left, POLL_MS)
    await act(async () => { await vi.advanceTimersByTimeAsync(step) })
    left -= step
  } while (left > 0)
}

/** Count gulp starts: the stage's class gaining `gulping`. */
let gulps = 0
let observer: MutationObserver | null = null
let stageEl: HTMLElement | null = null
const hasGulping = (className: string | null) => (className ?? '').split(/\s+/).includes('gulping')
function countRecords(records: MutationRecord[]) {
  records.forEach((record, i) => {
    const after = i + 1 < records.length ? records[i + 1].oldValue : stageEl?.getAttribute('class') ?? null
    if (!hasGulping(record.oldValue) && hasGulping(after)) gulps += 1
  })
}
function watchGulps() {
  gulps = 0
  observer?.disconnect()
  stageEl = screen.getByTestId('rabbit-hole-stage')
  observer = new MutationObserver(countRecords)
  observer.observe(stageEl, { attributes: true, attributeFilter: ['class'], attributeOldValue: true })
}
const gulpCount = () => {
  if (observer) countRecords(observer.takeRecords())
  return gulps
}
const isGulping = () => screen.getByTestId('rabbit-hole-stage').classList.contains('gulping')

/** Render, let the first polls land, and start counting gulps. */
async function boot(path = '/projection') {
  renderProjection(path)
  for (let i = 0; i < 5; i++) await advance(0)
  watchGulps()
}

const press = (key: string) => act(() => { fireEvent.keyDown(document.body, { key }) })

afterEach(() => {
  observer?.disconnect()
  observer = null
})

describe('scheduled gulps', () => {
  it('fires after intervalMinutes with no jitter at random 0.5', async () => {
    await boot()
    await advance(15 * MINUTE - 1)
    expect(gulpCount()).toBe(0)
    await advance(1)
    expect(isGulping()).toBe(true)
    expect(gulpCount()).toBe(1)
  })

  // The rest use a 3-minute interval: each simulated minute costs 30 display-control polls.
  it('jitters by up to −2 minutes', async () => {
    vi.mocked(Math.random).mockReturnValue(0)
    server.displayControl = rabbitHole({ intervalMinutes: 3 })
    await boot()
    await advance(1 * MINUTE - 1)
    expect(gulpCount()).toBe(0)
    await advance(1)
    expect(gulpCount()).toBe(1)
  })

  it('jitters by up to +2 minutes', async () => {
    vi.mocked(Math.random).mockReturnValue(0.999999)
    server.displayControl = rabbitHole({ intervalMinutes: 3 })
    await boot()
    await advance(5 * MINUTE - 10)
    expect(gulpCount()).toBe(0)
    await advance(10)
    expect(gulpCount()).toBe(1)
  })

  it('keeps firing, one gulp per interval', async () => {
    server.displayControl = rabbitHole({ intervalMinutes: 3 })
    await boot()
    await advance(9 * MINUTE)
    expect(gulpCount()).toBe(3)
  })

  it('does not fire when gulp is disabled', async () => {
    server.displayControl = rabbitHole({ enabled: false, intervalMinutes: 3 })
    await boot()
    await advance(10 * MINUTE)
    expect(gulpCount()).toBe(0)
  })

  it('stops when gulp is disabled from display control, and restarts when re-enabled', async () => {
    server.displayControl = rabbitHole({ intervalMinutes: 3 })
    await boot()
    await advance(2 * MINUTE)
    server.displayControl = rabbitHole({ enabled: false, intervalMinutes: 3 })
    await advance(10 * MINUTE)
    expect(gulpCount()).toBe(0)

    server.displayControl = rabbitHole({ enabled: true, intervalMinutes: 3 })
    await advance(POLL_MS)
    await advance(3 * MINUTE)
    expect(gulpCount()).toBe(1)
  })

  it('reschedules when the interval changes', async () => {
    server.displayControl = rabbitHole({ intervalMinutes: 3 })
    await boot()
    await advance(2 * MINUTE)
    server.displayControl = rabbitHole({ intervalMinutes: 5 })
    await advance(POLL_MS) // the new settings land; the 5 minutes start here
    await advance(5 * MINUTE - 1)
    expect(gulpCount()).toBe(0) // the old 3-minute timer is gone
    await advance(1)
    expect(gulpCount()).toBe(1)
  })

  it('does not fire while calibrating, and restarts the interval when calibration ends', async () => {
    server.displayControl = rabbitHole({ intervalMinutes: 3 })
    await boot()
    await advance(2 * MINUTE)
    press('c')
    expect(screen.getByTestId('calibration-grid')).toBeTruthy()
    await advance(10 * MINUTE)
    expect(gulpCount()).toBe(0)

    press('Escape')
    expect(screen.queryByTestId('calibration-grid')).toBeNull()
    await advance(3 * MINUTE - 1)
    expect(gulpCount()).toBe(0)
    await advance(1)
    expect(gulpCount()).toBe(1)
  })

  it('does not fire in the standard layout', async () => {
    revision += 1
    server.displayControl = displayControlV2({ revision })
    renderProjection('/projection')
    for (let i = 0; i < 5; i++) await advance(0)
    await advance(10 * MINUTE)
    expect(document.querySelector('.gulping')).toBeNull()
    expect(screen.queryByTestId('rabbit-hole-stage')).toBeNull()
  })

  it('uses the spec default (on, every 15 minutes) when only the URL picks the rabbit hole over v1', async () => {
    server.displayControl = displayControlV1()
    await boot('/projection?layout=rabbit-hole')
    await advance(15 * MINUTE - 1)
    expect(gulpCount()).toBe(0)
    await advance(1)
    expect(gulpCount()).toBe(1)
  })
})

describe('?gulpEvery= (minutes, 0 = off)', () => {
  it('turns scheduled gulps off with 0, over display control v2', async () => {
    await boot('/projection?gulpEvery=0')
    await advance(20 * MINUTE)
    expect(gulpCount()).toBe(0)
  })

  it('sets the interval over v1', async () => {
    server.displayControl = displayControlV1()
    await boot('/projection?layout=rabbit-hole&gulpEvery=3')
    await advance(3 * MINUTE - 1)
    expect(gulpCount()).toBe(0)
    await advance(1)
    expect(gulpCount()).toBe(1)
  })
})

describe('remote gulps (effectCommand)', () => {
  it('a new effectCommand triggers exactly one gulp', async () => {
    await boot()
    server.displayControl = rabbitHole({}, effect('fx-1'))
    await advance(POLL_MS)
    expect(isGulping()).toBe(true)

    // The same command stays in later snapshots (other settings change): no replay.
    await advance(2 * MINUTE)
    server.displayControl = rabbitHole({}, effect('fx-1'))
    await advance(2 * MINUTE)
    expect(gulpCount()).toBe(1)
  })

  it('a second command with a new id gulps again (gap permitting)', async () => {
    await boot()
    server.displayControl = rabbitHole({}, effect('fx-1'))
    await advance(POLL_MS)
    await advance(2 * MINUTE)
    server.displayControl = rabbitHole({}, effect('fx-2'))
    await advance(POLL_MS)
    expect(gulpCount()).toBe(2)
  })

  it('ignores a command issued more than 30s ago', async () => {
    await boot()
    server.displayControl = rabbitHole({}, effect('fx-old', 31_000))
    await advance(POLL_MS)
    await advance(MINUTE)
    expect(gulpCount()).toBe(0)
  })

  it('accepts a command issued 29s ago', async () => {
    await boot()
    server.displayControl = rabbitHole({}, effect('fx-recent', 27_000))
    await advance(POLL_MS) // 29s old on receipt
    expect(gulpCount()).toBe(1)
  })

  it('is not replayed after a restart, even when the snapshot cache is gone', async () => {
    await boot()
    server.displayControl = rabbitHole({}, effect('fx-1'))
    await advance(POLL_MS)
    expect(gulpCount()).toBe(1)
    await advance(5_000)

    // Restart within the 30s window; the cached snapshot is lost, so the first
    // poll re-delivers the same revision with the same effect command.
    cleanup()
    storage.delete(DISPLAY_CONTROL_STORAGE_KEY)
    await boot()
    expect(isGulping()).toBe(false) // the first poll has landed (see the control below)
    await advance(POLL_MS * 3)
    expect(gulpCount()).toBe(0)
  })

  it('control: a fresh command on the first poll after a restart does gulp', async () => {
    await boot()
    cleanup()
    storage.delete(DISPLAY_CONTROL_STORAGE_KEY)
    server.displayControl = rabbitHole({}, effect('fx-boot'))
    renderProjection('/projection')
    for (let i = 0; i < 5; i++) await advance(0)
    expect(isGulping()).toBe(true)
  })

  it('is not replayed from the cached snapshot when the server is unreachable after a restart', async () => {
    await boot()
    server.displayControl = rabbitHole({}, effect('fx-1'))
    await advance(POLL_MS)
    expect(gulpCount()).toBe(1)
    await advance(5_000)

    // Drop the persisted id too: the cache alone must never carry the command.
    cleanup()
    storage.delete(DISPLAY_EFFECT_COMMAND_STORAGE_KEY)
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
      if (String(input).includes('display-control')) throw new TypeError('offline')
      return { ok: true, status: 200, headers: new Headers(), json: async () => server.projectedMenu } as Response
    })
    await boot()
    expect(isGulping()).toBe(false)
    await advance(POLL_MS * 3)
    expect(gulpCount()).toBe(0)
  })

  it('consumes a command that arrives in the standard layout; it does not fire on switching to the rabbit hole', async () => {
    revision += 1
    server.displayControl = displayControlV2({ revision })
    renderProjection('/projection')
    for (let i = 0; i < 5; i++) await advance(0)

    revision += 1
    server.displayControl = displayControlV2({ revision, ...effect('fx-standard') })
    await advance(POLL_MS)
    expect(document.querySelector('.gulping')).toBeNull()

    server.displayControl = rabbitHole({}, effect('fx-standard'))
    await advance(POLL_MS)
    watchGulps()
    await advance(POLL_MS * 3)
    expect(gulpCount()).toBe(0)
  })

  it('consumes a refused command (within the 60s gap); it is not queued', async () => {
    await boot()
    press('g')
    await advance(10_000)
    server.displayControl = rabbitHole({}, effect('fx-refused'))
    await advance(POLL_MS)
    expect(gulpCount()).toBe(1) // only the G gulp
    await advance(2 * MINUTE)
    expect(gulpCount()).toBe(1)
  })
})
