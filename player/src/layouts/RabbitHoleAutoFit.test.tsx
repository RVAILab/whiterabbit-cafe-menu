// @vitest-environment jsdom
import { cleanup, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sampleProjectedMenu } from '../test/fixtures/sampleProjectedMenu'
import {
  displayControlV1,
  renderProjection,
  stubLocalStorage,
  stubProjectionServer,
} from '../test/projectionHarness'

/**
 * jsdom has no layout, so stub the plate measurement: every plate is 800px
 * tall and its content needs `contentAt32` px at 32px type, scaling with the
 * `--fs` currently set on the menu.
 */
let contentAt32 = 600
const PLATE_HEIGHT = 800

function baseSizeOf(el: HTMLElement): number {
  const menu = el.closest<HTMLElement>('.rh-menu')
  return Number.parseFloat(menu?.style.getPropertyValue('--fs') || '32')
}

function stubPlateLayout() {
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (this: HTMLElement) {
    return this.classList.contains('rh-plate') ? PLATE_HEIGHT : 0
  })
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function (this: HTMLElement) {
    if (!this.classList.contains('rh-plate')) return 0
    return Math.max(PLATE_HEIGHT, Math.round((contentAt32 * baseSizeOf(this)) / 32))
  })
}

const menuBaseSize = () => screen.getByTestId('rabbit-hole-menu').style.getPropertyValue('--fs')

beforeEach(() => {
  contentAt32 = 600
  stubLocalStorage()
  stubProjectionServer({ projectedMenu: structuredClone(sampleProjectedMenu), displayControl: displayControlV1() })
  stubPlateLayout()
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('rabbit hole auto-fit', () => {
  it('renders at 32px when the menu fits', async () => {
    renderProjection('/projection?layout=rabbit-hole')
    await screen.findByTestId('rabbit-hole-stage')

    expect(menuBaseSize()).toBe('32px')
  })

  it('steps the type down until the plates fit', async () => {
    contentAt32 = 900 // 844 at 30, 788 at 28
    renderProjection('/projection?layout=rabbit-hole')
    await screen.findByTestId('rabbit-hole-stage')

    expect(menuBaseSize()).toBe('28px')
  })

  it('falls back to the standard layout and warns when the menu overflows at 26px', async () => {
    contentAt32 = 1100
    renderProjection('/projection?layout=rabbit-hole')

    expect(await screen.findByText('Noble Coffee')).toBeTruthy()
    expect(screen.queryByTestId('rabbit-hole-stage')).toBeNull()
    expect(console.warn).toHaveBeenCalledWith(expect.stringMatching(/does not fit .*26px/))
  })

  describe('with a bar stacked under eat-me', () => {
    const withBar = () => {
      const menu = structuredClone(sampleProjectedMenu)
      const alcohol = { ...menu.sections.find((section) => section.id === 'sweet')!, id: 'alcohol', name: 'Alcohol', side: 'bar' as const, position: 0 }
      return { ...menu, sections: [...menu.sections, alcohol] }
    }

    it('stacks the eat-me plate, the Bar title and the bar plate in column 3', async () => {
      stubProjectionServer({ projectedMenu: withBar(), displayControl: displayControlV1() })
      renderProjection('/projection?layout=rabbit-hole')
      const stack = await screen.findByTestId('rabbit-hole-stack')

      expect([...stack.children].map((child) => child.getAttribute('data-testid') ?? child.textContent)).toEqual([
        'rabbit-hole-plate-3',
        'Bar',
        'rabbit-hole-plate-bar',
      ])
      expect(screen.getByTestId('rabbit-hole-plate-bar').textContent).toContain('Alcohol')
    })

    it('steps the type down until the stack fits, though its plates never overflow', async () => {
      // Plates stay within their boxes; only the stack (800px) overflows, needing 900px at 32px.
      vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (this: HTMLElement) {
        return this.classList.contains('rh-stack') ? PLATE_HEIGHT : 0
      })
      vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function (this: HTMLElement) {
        return this.classList.contains('rh-stack') ? Math.round((900 * baseSizeOf(this)) / 32) : 0
      })
      stubProjectionServer({ projectedMenu: withBar(), displayControl: displayControlV1() })
      renderProjection('/projection?layout=rabbit-hole')
      await screen.findByTestId('rabbit-hole-stack')

      expect(menuBaseSize()).toBe('28px')
    })
  })
})
