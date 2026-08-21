// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { useProjectedMenu } from './hooks/useProjectedMenu'
import { PROJECTED_MENU_SECTIONS } from './lib/projectedMenu'

vi.mock('./hooks/useProjectedMenu', () => ({ useProjectedMenu: vi.fn() }))
vi.mock('./layouts/CustomerLayout', () => ({
  CustomerLayout: ({ board }: { board: { sections?: Array<{ heading: string }> } }) => (
    <div data-testid="customer-board">
      {board.sections?.map(({ heading }) => heading).join('|')}
    </div>
  ),
}))
vi.mock('./layouts/ProjectorLayout', () => ({ ProjectorLayout: () => null }))
vi.mock('./layouts/PrintLayout', () => ({ PrintLayout: () => null }))

const document = {
  schemaVersion: 1 as const,
  generatedAt: '2026-08-12T18:00:00.000Z',
  availabilityRevision: 'a'.repeat(43),
  sections: PROJECTED_MENU_SECTIONS.map((section, index) => ({
    id: section.id,
    name: section.name,
    items: [{
      id: `template-${index + 1}`,
      templateId: index + 1,
      name: `Item ${index + 1}`,
      basePrice: 4,
      variants: [],
      stockStatus: 'available' as const,
    }],
  })),
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('App projected menu authority', () => {
  it('shows an actionable unavailable state when no valid document exists', () => {
    vi.mocked(useProjectedMenu).mockReturnValue({
      document: null,
      isLoading: false,
      error: 'Projected menu request failed (503)',
      isDisplayLive: () => false,
    })

    render(<MemoryRouter><App /></MemoryRouter>)

    expect(screen.getByText('Unable to Load Menu')).toBeTruthy()
    expect(screen.getByText(/menu service and this display's network connection/i)).toBeTruthy()
  })

  it('renders the cached projected document while its latest refresh is failing', () => {
    vi.mocked(useProjectedMenu).mockReturnValue({
      document,
      isLoading: false,
      error: 'offline',
      isDisplayLive: () => false,
    })

    render(<MemoryRouter><App /></MemoryRouter>)

    expect(screen.getByTestId('customer-board').textContent).toBe(
      PROJECTED_MENU_SECTIONS.map(({ name }) => name).join('|'),
    )
    expect(screen.queryByText('Unable to Load Menu')).toBeNull()
  })
})
