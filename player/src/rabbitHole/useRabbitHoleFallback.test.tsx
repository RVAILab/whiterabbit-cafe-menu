// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ProjectedMenuDocument } from '../lib/projectedMenu'
import { sampleProjectedMenu } from '../test/fixtures/sampleProjectedMenu'
import { useRabbitHoleFallback } from './useRabbitHoleFallback'

const render = (document: ProjectedMenuDocument) =>
  renderHook(({ doc }) => useRabbitHoleFallback(doc), { initialProps: { doc: document } })

describe('useRabbitHoleFallback', () => {
  it('starts on the rabbit hole', () => {
    expect(render(structuredClone(sampleProjectedMenu)).result.current.fellBack).toBe(false)
  })

  it('falls back once the menu is reported as not fitting', () => {
    const { result } = render(structuredClone(sampleProjectedMenu))
    act(() => result.current.reportDoesNotFit())
    expect(result.current.fellBack).toBe(true)
  })

  it('stays fallen back when a poll returns the same menu again', () => {
    const { result, rerender } = render(structuredClone(sampleProjectedMenu))
    act(() => result.current.reportDoesNotFit())

    rerender({ doc: { ...structuredClone(sampleProjectedMenu), generatedAt: '2026-10-01T09:00:00.000Z' } })
    expect(result.current.fellBack).toBe(true)
  })

  it('tries the rabbit hole again when a different menu arrives', () => {
    const { result, rerender } = render(structuredClone(sampleProjectedMenu))
    act(() => result.current.reportDoesNotFit())

    const smaller = structuredClone(sampleProjectedMenu)
    smaller.sections = smaller.sections.slice(1)
    rerender({ doc: smaller })
    expect(result.current.fellBack).toBe(false)
  })
})
