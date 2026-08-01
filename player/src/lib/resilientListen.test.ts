import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The listener under test opens a real Sanity EventSource; swap the client for
// an observable we can drive by hand.
const listen = vi.fn()
vi.mock('./sanity', () => ({ client: { listen: (...args: unknown[]) => listen(...args) } }))

import { resilientListen, type SanityListenEvent } from './resilientListen'

/** Matches the watchdog constants in resilientListen.ts. */
const STALE_TIMEOUT_MS = 75_000
const WATCHDOG_INTERVAL_MS = 30_000

type Observer = {
  next: (event: SanityListenEvent) => void
  error: (err: unknown) => void
  complete: () => void
}

let observers: Observer[] = []

beforeEach(() => {
  vi.useFakeTimers()
  observers = []
  listen.mockReset()
  listen.mockImplementation(() => ({
    subscribe: (observer: Observer) => {
      observers.push(observer)
      return { unsubscribe: vi.fn() }
    },
  }))
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const current = () => observers[observers.length - 1]

function start(onHealthChange: (healthy: boolean) => void) {
  return resilientListen({
    query: '*[_type == "menuItem"]',
    onEvent: () => {},
    onHealthChange,
    label: 'test',
  })
}

describe('resilientListen health reporting', () => {
  it('reports healthy only once the channel is confirmed open', () => {
    const health: boolean[] = []
    const stop = start((h) => health.push(h))

    expect(health).toEqual([])

    current().next({ type: 'welcome' })
    expect(health).toEqual([true])

    stop()
  })

  it('goes unhealthy on the same staleness threshold the watchdog acts on', () => {
    const health: boolean[] = []
    const stop = start((h) => health.push(h))
    current().next({ type: 'welcome' })

    // A tick inside the window changes nothing.
    vi.advanceTimersByTime(WATCHDOG_INTERVAL_MS)
    expect(health).toEqual([true])

    // Silence past the window: the watchdog forces a reconnect, and liveness
    // follows it rather than disagreeing with it.
    vi.advanceTimersByTime(STALE_TIMEOUT_MS)
    expect(health).toEqual([true, false])
    expect(listen).toHaveBeenCalledTimes(2) // reconnected

    // Healthy again as soon as the new channel says welcome.
    current().next({ type: 'welcome' })
    expect(health).toEqual([true, false, true])

    stop()
  })

  it('keeps a healthy stream healthy while keep-alives arrive', () => {
    const health: boolean[] = []
    const stop = start((h) => health.push(h))
    current().next({ type: 'welcome' })

    for (let i = 0; i < 10; i += 1) {
      vi.advanceTimersByTime(WATCHDOG_INTERVAL_MS)
      current().next({ type: 'mutation', documentId: 'menuItem-1' })
    }

    expect(health).toEqual([true])
    expect(listen).toHaveBeenCalledTimes(1)

    stop()
  })

  it('reports unhealthy on a channel error and again on reconnect', () => {
    const health: boolean[] = []
    const stop = start((h) => health.push(h))
    current().next({ type: 'welcome' })

    current().error(new Error('channel error'))
    expect(health).toEqual([true, false])

    vi.advanceTimersByTime(2000) // backoff elapses, listener re-subscribes
    current().next({ type: 'welcome' })
    expect(health).toEqual([true, false, true])

    stop()
  })

  it('reports unhealthy once stopped', () => {
    const health: boolean[] = []
    const stop = start((h) => health.push(h))
    current().next({ type: 'welcome' })

    stop()

    expect(health).toEqual([true, false])
  })

  // The listener is load-bearing for the display; an observer of it is not.
  it('survives a health subscriber that throws', () => {
    const stop = resilientListen({
      query: '*[_type == "menuItem"]',
      onEvent: () => {},
      onHealthChange: () => {
        throw new Error('subscriber blew up')
      },
      label: 'test',
    })

    expect(() => current().next({ type: 'welcome' })).not.toThrow()
    expect(() => vi.advanceTimersByTime(STALE_TIMEOUT_MS + WATCHDOG_INTERVAL_MS)).not.toThrow()
    // Still self-healing.
    expect(listen).toHaveBeenCalledTimes(2)

    stop()
  })

  it('works with no health subscriber at all', () => {
    const stop = resilientListen({ query: '*', onEvent: () => {}, label: 'test' })
    expect(() => current().next({ type: 'welcome' })).not.toThrow()
    stop()
  })
})
