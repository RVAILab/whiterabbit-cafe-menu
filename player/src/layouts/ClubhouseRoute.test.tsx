// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sampleProjectedMenu } from '../test/fixtures/sampleProjectedMenu'
import {
  displayControlV2,
  renderProjection,
  rovaEvents,
  stubLocalStorage,
  stubProjectionServer,
  type ProjectionServer,
} from '../test/projectionHarness'

let server: ProjectionServer

beforeEach(() => {
  stubLocalStorage()
  vi.stubEnv('VITE_ROVA_API_KEY', 'test-rova-key')
  server = {
    projectedMenu: structuredClone(sampleProjectedMenu),
    displayControl: displayControlV2({ desired: { overlay: 'clubhouse', layout: 'rabbit-hole' } }),
    rovaEvents: rovaEvents(),
  }
  stubProjectionServer(server)
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('the clubhouse overlay in the rabbit hole', () => {
  it('keeps the menu up and puts the café and clubhouse hours at the bottom of column 3, inside the stage', async () => {
    renderProjection('/projection')

    const notice = await screen.findByTestId('rh-clubhouse')
    const column3 = notice.closest('[data-testid="rabbit-hole-col3"]')
    expect(column3?.lastElementChild).toBe(notice)
    expect(column3?.closest('[data-testid="rabbit-hole-menu"]')).toBeTruthy()
    expect(within(notice).getByText('Clubhouse open')).toBeTruthy()
    expect(within(notice).getByText('10am–6pm · Mon–Sat')).toBeTruthy()
    expect(within(notice).getByText('from 9am')).toBeTruthy()
    expect(await screen.findByTestId('rh-hole-event')).toBeTruthy()

    expect(screen.getByTestId('rabbit-hole-menu')).toBeTruthy()
    expect(screen.getByTestId('rabbit-hole-stage').classList.contains('clubhouse')).toBe(true)
    expect(screen.getByTestId('rabbit-hole-overlays').childElementCount).toBe(0)
  })

  it('toggles off with the 7 key, giving column 3 back to its plates', async () => {
    renderProjection('/projection')
    await screen.findByTestId('rh-clubhouse')

    act(() => { fireEvent.keyDown(document.body, { key: '7' }) })

    expect(screen.queryByTestId('rh-clubhouse')).toBeNull()
    expect(screen.queryByTestId('rabbit-hole-col3')).toBeNull()
    expect(screen.getByTestId('rabbit-hole-stage').classList.contains('clubhouse')).toBe(false)
  })
})
