// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { HOLE_VARIANTS } from '../rabbitHole/holeVariants'
import { sampleProjectedMenu } from '../test/fixtures/sampleProjectedMenu'
import {
  displayControlV2,
  renderProjection,
  stubLocalStorage,
  stubProjectionServer,
  type ProjectionServer,
} from '../test/projectionHarness'

/* ---------- browser stubs: canvas, rAF, matchMedia ---------- */

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
function stubAnimationFrames() {
  frames = new Map()
  let nextId = 1
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    const id = nextId++
    frames.set(id, cb)
    return id
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => { frames.delete(id) })
}
function tick(now: number) {
  const pending = [...frames.values()]
  frames.clear()
  act(() => { for (const cb of pending) cb(now) })
}

/* ---------- harness ---------- */

let server: ProjectionServer
let vortexDraw: MockInstance
let warn: MockInstance

const rabbitHoleV2 = (rabbitHole: Record<string, unknown>) =>
  displayControlV2({
    desired: {
      layout: 'rabbit-hole',
      rabbitHole: { variant: 'dive', speed: 0.4, gulp: { enabled: true, intervalMinutes: 15, onMenuChange: true }, ...rabbitHole },
    },
  })

beforeEach(() => {
  stubLocalStorage()
  server = { projectedMenu: structuredClone(sampleProjectedMenu), displayControl: rabbitHoleV2({}) }
  stubProjectionServer(server)
  stubAnimationFrames()
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    (() => fakeContext()) as unknown as HTMLCanvasElement['getContext'],
  )
  vortexDraw = vi.spyOn(HOLE_VARIANTS.vortex, 'draw')
  vi.spyOn(console, 'log').mockImplementation(() => {})
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

const holeCanvas = () => screen.findByTestId('rabbit-hole-canvas')
const activeVariant = async () => (await holeCanvas()).getAttribute('data-variant')
const press = (key: string, init: Partial<KeyboardEventInit> = {}) =>
  fireEvent.keyDown(document.body, { key, ...init })

describe('choosing the hole variant', () => {
  it('draws the variant display control v2 asks for', async () => {
    server.displayControl = rabbitHoleV2({ variant: 'vortex' })
    renderProjection('/projection')

    await vi.waitFor(async () => expect(await activeVariant()).toBe('vortex'))
    tick(1000)
    tick(1100)
    expect(vortexDraw).toHaveBeenCalled()
    expect(vortexDraw.mock.calls.at(-1)![2]).toEqual([300, 520])
  })

  it('lets ?variant= win over display control', async () => {
    server.displayControl = rabbitHoleV2({ variant: 'vortex' })
    renderProjection('/projection?variant=dive')

    // The layout itself comes from display control, so the canvas means it landed.
    expect(await activeVariant()).toBe('dive')
  })

  it('selects vortex from ?variant= alone', async () => {
    renderProjection('/projection?layout=rabbit-hole&variant=vortex')
    expect(await activeVariant()).toBe('vortex')
  })

  it('falls back to dive, with a warning, for an unknown ?variant=', async () => {
    renderProjection('/projection?layout=rabbit-hole&variant=wormhole')
    expect(await activeVariant()).toBe('dive')
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('wormhole'))
  })

  it('falls back to dive for an unknown display-control variant', async () => {
    server.displayControl = rabbitHoleV2({ variant: 'teacup' })
    renderProjection('/projection')
    expect(await activeVariant()).toBe('dive')
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('teacup'))
  })
})

describe('choosing the hole speed', () => {
  const phaseStep = async () => {
    await vi.waitFor(async () => expect(await activeVariant()).toBe('vortex'))
    tick(5000)
    const start = vortexDraw.mock.calls.at(-1)![1] as number
    tick(5100)
    return (vortexDraw.mock.calls.at(-1)![1] as number) - start
  }

  it('takes the speed from display control v2', async () => {
    server.displayControl = rabbitHoleV2({ variant: 'vortex', speed: 0.8 })
    renderProjection('/projection')
    expect(await phaseStep()).toBeCloseTo(0.08, 5)
  })

  it('lets ?speed= win over display control', async () => {
    server.displayControl = rabbitHoleV2({ variant: 'vortex', speed: 0.8 })
    renderProjection('/projection?speed=0.3')
    expect(await phaseStep()).toBeCloseTo(0.03, 5)
  })
})

describe('Shift+1 / Shift+2 (dev builds only)', () => {
  it('switch the variant locally in dev', async () => {
    renderProjection('/projection?layout=rabbit-hole')
    const canvas = await holeCanvas()
    expect(canvas.getAttribute('data-variant')).toBe('dive')

    press('@', { shiftKey: true })
    expect(canvas.getAttribute('data-variant')).toBe('vortex')
    press('!', { shiftKey: true })
    expect(canvas.getAttribute('data-variant')).toBe('dive')
  })

  it('do not touch the visualization keys 1 and 2', async () => {
    renderProjection('/projection?layout=rabbit-hole')
    const canvas = await holeCanvas()
    press('2')
    expect(canvas.getAttribute('data-variant')).toBe('dive')
  })

  it('are inert in production builds', async () => {
    vi.stubEnv('DEV', false)
    renderProjection('/projection?layout=rabbit-hole')
    const canvas = await holeCanvas()

    press('@', { shiftKey: true })
    expect(canvas.getAttribute('data-variant')).toBe('dive')
  })

  it('are inert while calibrating', async () => {
    renderProjection('/projection?layout=rabbit-hole&calibrate=1')
    await screen.findByTestId('calibration-grid')
    const canvas = await holeCanvas()

    press('@', { shiftKey: true })
    expect(canvas.getAttribute('data-variant')).toBe('dive')
  })
})
