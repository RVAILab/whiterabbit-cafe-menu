// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { entryScript, useReloadOnNewDeploy } from './useReloadOnNewDeploy'

const page = (script: string) => `<!doctype html><html><head><script type="module" crossorigin src="${script}"></script></head></html>`

let reload: ReturnType<typeof vi.fn>
let served: string

beforeEach(() => {
  vi.useFakeTimers()
  sessionStorage.clear()
  document.head.innerHTML = '<script type="module" src="/assets/index-OLD111.js"></script>'
  reload = vi.fn()
  vi.stubGlobal('location', { ...window.location, reload })
  served = page('/assets/index-OLD111.js')
  vi.stubGlobal('fetch', vi.fn(async () => new Response(served)))
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const tick = () => act(async () => { await vi.advanceTimersByTimeAsync(1000) })

describe('entryScript', () => {
  it('finds the hashed entry script in a built index.html or a script URL', () => {
    expect(entryScript(page('/assets/index-DKY8M01_.js'))).toBe('/assets/index-DKY8M01_.js')
    expect(entryScript('https://menu.example/assets/index-a-b_c.js')).toBe('/assets/index-a-b_c.js')
    expect(entryScript('<script src="/src/main.tsx"></script>')).toBeNull()
  })
})

describe('useReloadOnNewDeploy', () => {
  it('stays put while index.html names the running build', async () => {
    renderHook(() => useReloadOnNewDeploy(true, 1000))
    await tick()
    await tick()
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(reload).not.toHaveBeenCalled()
  })

  it('reloads once a new build is deployed', async () => {
    renderHook(() => useReloadOnNewDeploy(true, 1000))
    served = page('/assets/index-NEW222.js')
    await tick()
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('does not reload again for a build it already reloaded for (stale cache)', async () => {
    sessionStorage.setItem('white-rabbit:reloaded-for-build', '/assets/index-NEW222.js')
    served = page('/assets/index-NEW222.js')
    renderHook(() => useReloadOnNewDeploy(true, 1000))
    await tick()
    expect(reload).not.toHaveBeenCalled()
  })

  it('ignores a failed check and never runs when disabled (dev builds)', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('offline'))
    renderHook(() => useReloadOnNewDeploy(true, 1000))
    await tick()
    expect(reload).not.toHaveBeenCalled()

    cleanup()
    vi.mocked(fetch).mockClear()
    renderHook(() => useReloadOnNewDeploy(false, 1000))
    await tick()
    expect(fetch).not.toHaveBeenCalled()
  })
})
