// @vitest-environment jsdom
import { cleanup, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sampleProjectedMenu } from '../test/fixtures/sampleProjectedMenu'
import {
  displayControlV1,
  renderProjection,
  stubLocalStorage,
  stubProjectionServer,
} from '../test/projectionHarness'

beforeEach(() => {
  stubLocalStorage()
  stubProjectionServer({ projectedMenu: sampleProjectedMenu, displayControl: displayControlV1() })
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('/projection?layout=featured', () => {
  it('renders the sample menu on the featured wall', async () => {
    renderProjection('/projection?layout=featured')

    const menu = await screen.findByTestId('featured-menu')
    // Lead block = first drink section; its first item is featured, the rest listed.
    const lead = within(menu).getByRole('region', { name: 'Noble Coffee' })
    expect(within(lead).getByText('Latte')).toBeTruthy()
    expect(within(lead).getByText('Americano')).toBeTruthy()
    // The next drink sections fill the grid; food goes in the capsule.
    expect(within(menu).getByRole('region', { name: 'Chocolates' })).toBeTruthy()
    expect(within(menu).getByRole('region', { name: 'Zi Spice Chai' })).toBeTruthy()
    const food = within(menu).getByRole('region', { name: 'Food' })
    expect(within(food).getByText('Savory')).toBeTruthy()
    expect(within(food).getByText('Sweet')).toBeTruthy()
    // Only one copy of the menu is on screen.
    expect(screen.getAllByText('Noble Coffee')).toHaveLength(1)
  })
})
