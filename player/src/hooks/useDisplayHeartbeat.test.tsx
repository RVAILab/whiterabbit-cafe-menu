// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { useDisplayHeartbeat } from './useDisplayHeartbeat'
import { resetDisplayIdCache } from '../lib/displayHeartbeat'

const INTERVAL = 1000

function Board({ isLive, route = '/' }: { isLive: () => boolean; route?: string }) {
  useDisplayHeartbeat({ isLive, route, intervalMs: INTERVAL })
  return <div>Cold Brew — $5</div>
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.useFakeTimers()
  resetDisplayIdCache()
  fetchMock = vi.fn(async () => ({ ok: true }) as Response)
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const tick = async (ms = INTERVAL) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

describe('useDisplayHeartbeat', () => {
  it('does not beat on mount — a passer-by is not a display', async () => {
    render(<Board isLive={() => true} />)

    expect(fetchMock).not.toHaveBeenCalled()

    await tick()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('beats with the same display id every interval while live', async () => {
    render(<Board isLive={() => true} route="/projection" />)

    await tick()
    await tick()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const bodies = fetchMock.mock.calls.map(([, init]) =>
      JSON.parse((init as RequestInit).body as string)
    )
    expect(bodies[0]).toEqual({ action: 'heartbeat', value: expect.any(String), route: '/projection' })
    expect(bodies[1].value).toBe(bodies[0].value)
  })

  it('stays silent while the watchdog says the display is not live', async () => {
    let live = false
    render(<Board isLive={() => live} />)

    await tick()
    expect(fetchMock).not.toHaveBeenCalled()

    live = true
    await tick()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not beat on routes that are not displays', async () => {
    function PrintBoard() {
      useDisplayHeartbeat({ isLive: () => true, route: '/print', enabled: false, intervalMs: INTERVAL })
      return <div>Print</div>
    }
    render(<PrintBoard />)

    await tick(INTERVAL * 5)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('stops beating once the board unmounts', async () => {
    const { unmount } = render(<Board isLive={() => true} />)
    await tick()
    unmount()

    await tick(INTERVAL * 3)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  // The invariant: the menu renders regardless of what telemetry does.
  it('keeps rendering when the Observatory path is unreachable', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    render(<Board isLive={() => true} />)

    await tick(INTERVAL * 3)

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(screen.getByText('Cold Brew — $5')).toBeTruthy()
  })

  it('keeps rendering when the heartbeat endpoint 500s', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 } as Response)
    render(<Board isLive={() => true} />)

    await tick(INTERVAL * 2)

    expect(screen.getByText('Cold Brew — $5')).toBeTruthy()
  })

  it('keeps rendering when the liveness getter itself throws', async () => {
    render(
      <Board
        isLive={() => {
          throw new Error('liveness blew up')
        }}
      />
    )

    await tick(INTERVAL * 2)

    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.getByText('Cold Brew — $5')).toBeTruthy()
  })
})
