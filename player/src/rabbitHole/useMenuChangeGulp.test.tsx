// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProjectedMenuDocument } from '../lib/projectedMenu'
import { sampleProjectedMenu } from '../test/fixtures/sampleProjectedMenu'
import { createGulpController, GULP_TIMELINE, type GulpPhase } from './gulpController'
import { useMenuChangeGulp } from './useMenuChangeGulp'

const menu = (revision: string): ProjectedMenuDocument => ({
  ...structuredClone(sampleProjectedMenu),
  availabilityRevision: revision.padEnd(43, 'x'),
})

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('useMenuChangeGulp', () => {
  it('holds a change that lands the tick another gulp starts, before React has seen that gulp', () => {
    const controller = createGulpController({ refusal: () => null })
    const first = menu('a')
    const next = menu('b')
    const { result, rerender } = renderHook(
      ({ document, phase }: { document: ProjectedMenuDocument; phase: GulpPhase }) =>
        useMenuChangeGulp({
          document,
          enabled: true,
          gulp: { gulp: controller.gulp, getState: controller.getState, phase },
        }),
      { initialProps: { document: first, phase: 'idle' as GulpPhase } },
    )

    // Another trigger starts a gulp; React state still says idle when the new menu arrives.
    expect(controller.gulp()).toBe(true)
    rerender({ document: next, phase: 'idle' })
    expect(result.current).toBe(first)

    // At re-arm the held change goes through the gulp path again (refused by the 60s gap → applied).
    act(() => { vi.advanceTimersByTime(GULP_TIMELINE.rearmAt) })
    rerender({ document: next, phase: 'returning' })
    rerender({ document: next, phase: 'idle' })
    expect(result.current).toBe(next)
  })
})
