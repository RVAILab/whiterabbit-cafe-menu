// @vitest-environment jsdom
import { act, cleanup, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { HOLE_VARIANTS } from '../rabbitHole/holeVariants'
import { sampleProjectedMenu } from '../test/fixtures/sampleProjectedMenu'
import {
  bootProjection,
  displayControlV1,
  fakeProjectionTimers,
  stubLocalStorage,
  stubProjectionServer,
  type ProjectionServer,
} from '../test/projectionHarness'

/* ---------- browser stubs: canvas, rAF, matchMedia, visibility ---------- */

function fakeContext(): CanvasRenderingContext2D {
  const gradient = { addColorStop: vi.fn() }
  return new Proxy({} as Record<string | symbol, unknown>, {
    get(target, key) {
      if (!(key in target)) {
        target[key] = key === 'createRadialGradient' ? vi.fn(() => gradient) : vi.fn()
      }
      return target[key]
    },
    set(target, key, value) {
      target[key] = value
      return true
    },
  }) as unknown as CanvasRenderingContext2D
}

let frames: Map<number, FrameRequestCallback>
let nextFrameId: number
function stubAnimationFrames() {
  frames = new Map()
  nextFrameId = 1
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    const id = nextFrameId++
    frames.set(id, cb)
    return id
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => { frames.delete(id) })
}
/** Run every pending frame callback at `now` ms. */
function tick(now: number) {
  const pending = [...frames.values()]
  frames.clear()
  act(() => { for (const cb of pending) cb(now) })
}

let reducedMotion: { matches: boolean; listeners: Set<(e: { matches: boolean }) => void> }
function stubMatchMedia(matches = false) {
  reducedMotion = { matches, listeners: new Set() }
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() { return query.includes('prefers-reduced-motion') && reducedMotion.matches },
    media: query,
    addEventListener: (_: string, l: (e: { matches: boolean }) => void) => reducedMotion.listeners.add(l),
    removeEventListener: (_: string, l: (e: { matches: boolean }) => void) => reducedMotion.listeners.delete(l),
  }))
}
function setReducedMotion(matches: boolean) {
  reducedMotion.matches = matches
  act(() => { for (const l of reducedMotion.listeners) l({ matches }) })
}

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state })
  act(() => { document.dispatchEvent(new Event('visibilitychange')) })
}

/* ---------- harness ---------- */

let server: ProjectionServer
let draw: MockInstance

beforeEach(() => {
  fakeProjectionTimers()
  stubLocalStorage()
  server = { projectedMenu: structuredClone(sampleProjectedMenu), displayControl: displayControlV1() }
  stubProjectionServer(server)
  stubAnimationFrames()
  stubMatchMedia(false)
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    (() => fakeContext()) as unknown as HTMLCanvasElement['getContext'],
  )
  draw = vi.spyOn(HOLE_VARIANTS.dive, 'draw')
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

/** Boot `path` with every first poll landed, then return the hole canvas. */
async function holeCanvasAt(path: string) {
  await bootProjection(path)
  return screen.getByTestId('rabbit-hole-canvas')
}
const lastPhase = () => draw.mock.calls.at(-1)![1] as number

describe('the hole background on /projection?layout=rabbit-hole', () => {
  it('draws the dive variant on a stage-resolution canvas behind the plates', async () => {
    const canvas = await holeCanvasAt('/projection?layout=rabbit-hole')
    expect(canvas.closest('[data-testid="rabbit-hole-layer-background"]')).toBeTruthy()
    expect(canvas.getAttribute('data-variant')).toBe('dive')
    expect((canvas as HTMLCanvasElement).width).toBe(1920)
    expect((canvas as HTMLCanvasElement).height).toBe(1080)
    expect(canvas.getAttribute('data-hole-state')).toBe('running')

    tick(1000)
    tick(1100)
    expect(draw).toHaveBeenCalled()
    expect(draw.mock.calls.at(-1)![2]).toEqual([300, 520])
  })

  it('advances an accumulated phase at ?speed=, never wall-clock time', async () => {
    await holeCanvasAt('/projection?layout=rabbit-hole&speed=0.5')

    tick(5000)
    const start = lastPhase()
    tick(5100) // 0.1s at speed 0.5
    expect(lastPhase() - start).toBeCloseTo(0.05, 5)
    tick(9100) // a 4s stall is capped at 0.1s
    expect(lastPhase() - start).toBeCloseTo(0.1, 5)
  })

  it.each([
    ['5', 0.5],
    ['0.05', 0.005],
  ])('allows ?speed=%s outside the display-control range, for testing', async (speed, step) => {
    await holeCanvasAt(`/projection?layout=rabbit-hole&speed=${speed}`)

    tick(5000)
    const start = lastPhase()
    tick(5100)
    expect(lastPhase() - start).toBeCloseTo(step, 5)
  })

  it('defaults the speed to 0.4', async () => {
    await holeCanvasAt('/projection?layout=rabbit-hole')

    tick(5000)
    const start = lastPhase()
    tick(5100)
    expect(lastPhase() - start).toBeCloseTo(0.04, 5)
  })

  it('pauses while an overlay is active', async () => {
    server.displayControl = displayControlV1({
      desired: { overlay: 'closed', visualization: 'none', visualizationMode: 'background' },
    })
    const canvas = await holeCanvasAt('/projection?layout=rabbit-hole')
    expect(canvas.getAttribute('data-hole-state')).toBe('paused')
    // The overlay animates itself, so count hole draws rather than frames.
    draw.mockClear()
    tick(1000)
    tick(1100)
    expect(draw).not.toHaveBeenCalled()
  })

  it('pauses while the tab is hidden and resumes without a jump', async () => {
    const canvas = await holeCanvasAt('/projection?layout=rabbit-hole')
    tick(1000)
    tick(1100)
    const before = lastPhase()

    setVisibility('hidden')
    expect(canvas.getAttribute('data-hole-state')).toBe('paused')
    expect(frames.size).toBe(0)

    setVisibility('visible')
    expect(canvas.getAttribute('data-hole-state')).toBe('running')
    tick(60_000) // first frame after a long pause adds nothing
    expect(lastPhase()).toBeCloseTo(before, 5)
  })

  it('holds a static frame under prefers-reduced-motion', async () => {
    stubMatchMedia(true)
    const canvas = await holeCanvasAt('/projection?layout=rabbit-hole')
    expect(canvas.getAttribute('data-hole-state')).toBe('static')
    expect(draw).toHaveBeenCalledTimes(1) // one readable frame, then nothing
    expect(frames.size).toBe(0)

    setReducedMotion(false)
    expect(canvas.getAttribute('data-hole-state')).toBe('running')
    expect(frames.size).toBe(1)
  })

  it('tears down the frame loop and its listeners when the layout goes away', async () => {
    const view = await bootProjection('/projection?layout=rabbit-hole')
    tick(1000)
    expect(frames.size).toBe(1)
    expect(reducedMotion.listeners.size).toBe(1)

    view.unmount()
    expect(frames.size).toBe(0)
    expect(reducedMotion.listeners.size).toBe(0)
    // A stale visibility listener would restart the loop here.
    setVisibility('hidden')
    setVisibility('visible')
    expect(frames.size).toBe(0)
  })
})

describe('the standard layout', () => {
  it('has no hole canvas', async () => {
    await bootProjection('/projection')
    expect(screen.getByText('Noble Coffee')).toBeTruthy()
    expect(screen.queryByTestId('rabbit-hole-canvas')).toBeNull()
  })
})
