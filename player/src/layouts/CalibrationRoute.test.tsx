// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sampleProjectedMenu } from '../test/fixtures/sampleProjectedMenu'
import {
  advance,
  bootProjection,
  displayControlV1,
  displayControlV2,
  fakeProjectionTimers,
  stubLocalStorage,
  stubProjectionServer,
  type ProjectionServer,
} from '../test/projectionHarness'

let server: ProjectionServer
let storage: Map<string, string>

const CALIBRATION_KEY = 'white-rabbit:projection-calibration:v1'
// jsdom's viewport is 1024×768, so the default 16:9 letterbox is 1024×576 at y = 96.
const handle = (i: number) => screen.getByTestId(`calibration-handle-${i}`)
const handlePct = (i: number) => [parseFloat(handle(i).style.left), parseFloat(handle(i).style.top)]
const pinTransform = () => screen.getByTestId('pinned-surface').style.transform
const press = (key: string, init: Partial<KeyboardEventInit> = {}) =>
  act(() => { fireEvent.keyDown(document.body, { key, ...init }) })
const calibrateCommand = { id: 'cmd-calibrate', value: 'calibrate', issuedAt: '2026-09-30T16:00:00.000Z' }

beforeEach(() => {
  fakeProjectionTimers()
  storage = stubLocalStorage()
  server = { projectedMenu: structuredClone(sampleProjectedMenu), displayControl: displayControlV1() }
  stubProjectionServer(server)
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

describe('projection calibration', () => {
  it('opens with ?calibrate=1 in the rabbit hole layout', async () => {
    await bootProjection('/projection?layout=rabbit-hole&calibrate=1')

    expect(screen.getByTestId('calibration-grid')).toBeTruthy()
    expect(screen.getAllByTestId(/^calibration-handle-/)).toHaveLength(4)
    expect(screen.getByTestId('calibration-help').textContent).toMatch(/Enter/)
  })

  it('opens with the C key in the rabbit hole layout', async () => {
    await bootProjection('/projection?layout=rabbit-hole')
    expect(screen.queryByTestId('calibration-grid')).toBeNull()

    press('c')

    expect(screen.getByTestId('calibration-grid')).toBeTruthy()
    expect(screen.getAllByTestId(/^calibration-handle-/)).toHaveLength(4)
  })

  it('opens from a "calibrate" screen command over display control v1', async () => {
    server.displayControl = displayControlV1({ revision: 2, screenCommand: calibrateCommand })
    await bootProjection('/projection?layout=rabbit-hole')

    expect(screen.getByTestId('calibration-grid')).toBeTruthy()
  })

  it('opens from a "calibrate" screen command in the snapshot that switches to the rabbit hole', async () => {
    server.displayControl = displayControlV2({ desired: { layout: 'rabbit-hole' }, screenCommand: calibrateCommand })
    await bootProjection('/projection')

    expect(screen.getByTestId('calibration-grid')).toBeTruthy()
  })

  it('opens from a "calibrate" screen command that lands before the menu, once the menu loads', async () => {
    server.projectedMenu = null
    server.displayControl = displayControlV1({ revision: 2, screenCommand: calibrateCommand })
    await bootProjection('/projection?layout=rabbit-hole')
    expect(screen.queryByTestId('rabbit-hole-stage')).toBeNull()

    server.projectedMenu = structuredClone(sampleProjectedMenu)
    await advance(20_000) // the next menu poll

    expect(screen.getByTestId('calibration-grid')).toBeTruthy()
  })

  it('honours a "calibrate" screen command once the layout switches to the rabbit hole within 30s', async () => {
    server.displayControl = displayControlV2({ revision: 2, screenCommand: calibrateCommand })
    await bootProjection('/projection')
    await advance(20_000)
    expect(screen.queryByTestId('calibration-grid')).toBeNull()

    server.displayControl = displayControlV2({ revision: 3, desired: { layout: 'rabbit-hole' }, screenCommand: calibrateCommand })
    await advance(2_000)

    expect(screen.getByTestId('calibration-grid')).toBeTruthy()
  })

  it('drops a "calibrate" screen command not honoured within 30s, with a warning', async () => {
    server.displayControl = displayControlV2({ revision: 2, screenCommand: calibrateCommand })
    await bootProjection('/projection')
    await advance(30_000)
    expect(console.warn).toHaveBeenCalledWith(expect.stringMatching(/calibrat/i))

    server.displayControl = displayControlV2({ revision: 3, desired: { layout: 'rabbit-hole' }, screenCommand: calibrateCommand })
    await advance(2_000)

    expect(screen.getByTestId('rabbit-hole-stage')).toBeTruthy()
    expect(screen.queryByTestId('calibration-grid')).toBeNull()
  })

  it('ignores calibration entry in the standard layout (it is not pinned)', async () => {
    await bootProjection('/projection?calibrate=1')
    expect(screen.getAllByText('Noble Coffee').length).toBeGreaterThan(0)

    press('c')

    expect(screen.queryByTestId('calibration-grid')).toBeNull()
  })

  it('nudges the selected corner 1px (Shift: 10px) with the arrows, clamped to the viewport', async () => {
    await bootProjection('/projection?layout=rabbit-hole&calibrate=1')
    expect(handlePct(0)).toEqual([0, 12.5])

    press('ArrowLeft')
    expect(handlePct(0)).toEqual([0, 12.5])

    press('ArrowRight')
    expect(handlePct(0)[0]).toBeCloseTo((1 / 1024) * 100)
    press('ArrowRight', { shiftKey: true })
    expect(handlePct(0)[0]).toBeCloseTo((11 / 1024) * 100)
    press('ArrowDown', { shiftKey: true })
    expect(handlePct(0)[1]).toBeCloseTo((106 / 768) * 100)

    for (let i = 0; i < 12; i++) press('ArrowUp', { shiftKey: true })
    expect(handlePct(0)[1]).toBe(0)

    press('Tab')
    expect(handle(1).getAttribute('aria-selected')).toBe('true')
    press('ArrowDown')
    expect(handlePct(1)[1]).toBeCloseTo((97 / 768) * 100)
    press('Tab', { shiftKey: true })
    press('Tab', { shiftKey: true })
    expect(handle(3).getAttribute('aria-selected')).toBe('true')
  })

  it('cancels with Esc, restoring the previous corners without saving', async () => {
    await bootProjection('/projection?layout=rabbit-hole')
    const before = pinTransform()

    press('c')
    press('ArrowRight', { shiftKey: true })
    expect(pinTransform()).not.toBe(before)
    press('Escape')

    expect(screen.queryByTestId('calibration-grid')).toBeNull()
    expect(pinTransform()).toBe(before)
    expect(storage.has(CALIBRATION_KEY)).toBe(false)
  })

  it('owns the keyboard while calibrating: other projector shortcuts do not fire', async () => {
    await bootProjection('/projection?layout=rabbit-hole&calibrate=1')
    const overlays = screen.getByTestId('rabbit-hole-overlays')

    for (const key of ['0', '8', '9']) press(key)

    expect(overlays.childElementCount).toBe(0)
    expect(screen.getByTestId('calibration-grid')).toBeTruthy()
  })

  it('saves with Enter, and a remount applies the saved corners', async () => {
    await bootProjection('/projection?layout=rabbit-hole&calibrate=1')
    const defaultFit = pinTransform()

    press('ArrowRight', { shiftKey: true })
    press('Enter')

    expect(screen.queryByTestId('calibration-grid')).toBeNull()
    const saved = JSON.parse(storage.get(CALIBRATION_KEY)!)
    expect(saved.version).toBe(1)
    expect(saved.corners[0][0]).toBeCloseTo(10 / 1024)
    expect(saved.corners[0][1]).toBeCloseTo(0.125)
    expect(typeof saved.updatedAt).toBe('string')
    const calibrated = pinTransform()
    expect(calibrated).not.toBe(defaultFit)

    cleanup()
    await bootProjection('/projection?layout=rabbit-hole')
    expect(pinTransform()).toBe(calibrated)
  })

  it('resets the draft to the default fit with R', async () => {
    storage.set(CALIBRATION_KEY, JSON.stringify({
      version: 1,
      corners: [[0.1, 0.2], [0.9, 0.2], [0.9, 0.8], [0.1, 0.8]],
      updatedAt: '2026-09-30T16:00:00.000Z',
    }))
    await bootProjection('/projection?layout=rabbit-hole&calibrate=1')
    expect(handlePct(0)).toEqual([10, 20])

    press('r')

    expect(handlePct(0)).toEqual([0, 12.5])
    expect(handlePct(2)).toEqual([100, 87.5])
  })
})
