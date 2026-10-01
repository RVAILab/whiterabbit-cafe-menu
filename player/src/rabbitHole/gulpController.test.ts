import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createGulpController, GULP_MIN_GAP_MS, GULP_TIMELINE, type GulpController } from './gulpController'

let controller: GulpController
let refusal: string | null
let onStart: ReturnType<typeof vi.fn<() => void>>

beforeEach(() => {
  vi.useFakeTimers()
  refusal = null
  onStart = vi.fn<() => void>()
  controller = createGulpController({ refusal: () => refusal, onStart })
})

afterEach(() => {
  controller.destroy()
  vi.useRealTimers()
})

const advance = (ms: number) => vi.advanceTimersByTime(ms)

describe('the gulp timeline', () => {
  it('swallows at 0, swaps at 1300, releases at 2600 and re-arms at 4300', () => {
    const onSwallowed = vi.fn()
    expect(controller.getState()).toMatchObject({ phase: 'idle', gulping: false, armed: true, lastGulpAt: null })

    expect(controller.gulp({ onSwallowed })).toBe(true)
    expect(onStart).toHaveBeenCalledTimes(1)
    expect(controller.getState()).toMatchObject({ phase: 'swallowing', gulping: true, armed: false, speedTarget: 5 })
    expect(controller.getState().lastGulpAt).toBe(Date.now())

    advance(GULP_TIMELINE.swallowedAt - 1)
    expect(onSwallowed).not.toHaveBeenCalled()
    advance(1)
    expect(onSwallowed).toHaveBeenCalledTimes(1)
    expect(GULP_TIMELINE.swallowedAt).toBe(1300)

    advance(GULP_TIMELINE.releaseAt - GULP_TIMELINE.swallowedAt - 1)
    expect(controller.getState().gulping).toBe(true)
    advance(1)
    expect(controller.getState()).toMatchObject({ phase: 'returning', gulping: false, armed: false, speedTarget: 1 })
    expect(GULP_TIMELINE.releaseAt).toBe(2600)

    advance(GULP_TIMELINE.rearmAt - GULP_TIMELINE.releaseAt - 1)
    expect(controller.getState().armed).toBe(false)
    advance(1)
    expect(controller.getState()).toMatchObject({ phase: 'idle', armed: true })
    expect(GULP_TIMELINE.rearmAt).toBe(4300)
    expect(onSwallowed).toHaveBeenCalledTimes(1)
  })

  it('notifies subscribers on each phase change', () => {
    const listener = vi.fn()
    const unsubscribe = controller.subscribe(listener)
    controller.gulp()
    advance(GULP_TIMELINE.rearmAt)
    expect(listener).toHaveBeenCalledTimes(3) // swallowing, returning, idle
    unsubscribe()
    controller.gulp({ ignoreGap: true })
    expect(listener).toHaveBeenCalledTimes(3)
  })
})

describe('refusals', () => {
  it('refuses while a gulp is running, through the return', () => {
    expect(controller.gulp()).toBe(true)
    advance(500)
    expect(controller.gulp({ ignoreGap: true })).toBe(false)
    advance(GULP_TIMELINE.releaseAt)
    expect(controller.gulp({ ignoreGap: true })).toBe(false)
    expect(onStart).toHaveBeenCalledTimes(1)
  })

  it('refuses within 60s of the last gulp unless ignoreGap', () => {
    expect(controller.gulp()).toBe(true)
    advance(GULP_TIMELINE.rearmAt)
    expect(controller.gulp()).toBe(false)
    advance(GULP_MIN_GAP_MS - GULP_TIMELINE.rearmAt - 1)
    expect(controller.gulp()).toBe(false)
    advance(1)
    expect(controller.gulp()).toBe(true)
    expect(GULP_MIN_GAP_MS).toBe(60_000)
  })

  it('accepts within the gap with ignoreGap once re-armed', () => {
    controller.gulp()
    advance(GULP_TIMELINE.rearmAt)
    expect(controller.gulp({ ignoreGap: true })).toBe(true)
  })

  it('refuses when the environment says so (overlay, reduced motion, calibrating, not mounted)', () => {
    const onSwallowed = vi.fn()
    refusal = 'overlay'
    expect(controller.gulp({ onSwallowed, ignoreGap: true })).toBe(false)
    expect(controller.getState().phase).toBe('idle')
    expect(controller.getState().lastGulpAt).toBeNull()
    advance(5000)
    expect(onSwallowed).not.toHaveBeenCalled()
    expect(onStart).not.toHaveBeenCalled()
  })

  it('a refused gulp does not move the 60s gap', () => {
    controller.gulp()
    advance(GULP_TIMELINE.rearmAt)
    refusal = 'overlay'
    advance(GULP_MIN_GAP_MS - GULP_TIMELINE.rearmAt - 1000)
    expect(controller.gulp()).toBe(false)
    refusal = null
    advance(1000)
    expect(controller.gulp()).toBe(true)
  })
})

it('refuses until configured, and uses the latest configuration', () => {
  const bare = createGulpController()
  expect(bare.gulp()).toBe(false)
  bare.configure({ refusal: () => null })
  expect(bare.gulp()).toBe(true)
  bare.destroy()
})

describe('cancel', () => {
  it('runs a pending onSwallowed immediately so a held-back swap is never lost, then idles', () => {
    const onSwallowed = vi.fn()
    controller.gulp({ onSwallowed })
    advance(400)
    controller.cancel()
    expect(onSwallowed).toHaveBeenCalledTimes(1)
    expect(controller.getState()).toMatchObject({ phase: 'idle', gulping: false, armed: true, speedTarget: 1 })
    advance(10_000)
    expect(onSwallowed).toHaveBeenCalledTimes(1)
  })

  it('does not run onSwallowed twice when cancelled after the swap', () => {
    const onSwallowed = vi.fn()
    controller.gulp({ onSwallowed })
    advance(GULP_TIMELINE.swallowedAt + 100)
    controller.cancel()
    expect(onSwallowed).toHaveBeenCalledTimes(1)
  })
})
