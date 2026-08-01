import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DISPLAY_ID_STORAGE_KEY,
  getDisplayId,
  postDisplayHeartbeat,
  resetDisplayIdCache,
  resolveHeartbeatEndpoint,
} from './displayHeartbeat'

const DISPLAY_ID_RE = /^[a-z0-9][a-z0-9-]{7,63}$/

function memoryStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial))
  return {
    store,
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
  }
}

afterEach(() => {
  resetDisplayIdCache()
  vi.restoreAllMocks()
})

describe('getDisplayId', () => {
  it('generates an id the server will accept and persists it', () => {
    const storage = memoryStorage()

    const id = getDisplayId(storage)

    expect(id).toMatch(DISPLAY_ID_RE)
    expect(storage.store.get(DISPLAY_ID_STORAGE_KEY)).toBe(id)
  })

  it('is stable across reloads — the same screen is one display', () => {
    const storage = memoryStorage()
    expect(getDisplayId(storage)).toBe(getDisplayId(storage))
  })

  it('replaces a corrupted stored id rather than sending a rejectable one', () => {
    const storage = memoryStorage({ [DISPLAY_ID_STORAGE_KEY]: 'NOT A VALID ID' })

    const id = getDisplayId(storage)

    expect(id).toMatch(DISPLAY_ID_RE)
  })

  it('still returns an id when storage is unavailable', () => {
    expect(getDisplayId(null)).toMatch(DISPLAY_ID_RE)
  })

  it('never throws when storage itself throws', () => {
    const hostile = {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => {
        throw new Error('SecurityError')
      },
    }

    const id = getDisplayId(hostile)

    expect(id).toMatch(DISPLAY_ID_RE)
    expect(getDisplayId(hostile)).toBe(id)
  })
})

describe('resolveHeartbeatEndpoint', () => {
  it('defaults to the same-origin display API', () => {
    expect(resolveHeartbeatEndpoint({})).toBe('/api/display')
  })

  it('can be turned off for an environment', () => {
    expect(resolveHeartbeatEndpoint({ VITE_DISPLAY_HEARTBEAT_ENDPOINT: 'off' })).toBeNull()
  })

  it('honours an explicit endpoint', () => {
    expect(
      resolveHeartbeatEndpoint({ VITE_DISPLAY_HEARTBEAT_ENDPOINT: 'https://x.test/api/display' })
    ).toBe('https://x.test/api/display')
  })
})

describe('postDisplayHeartbeat', () => {
  const args = { endpoint: '/api/display', displayId: 'a1111111-2222-4333-8444-555555555555', route: '/' }

  it('posts the heartbeat action with the display id and route', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true }) as Response)

    await expect(postDisplayHeartbeat({ ...args, fetchImpl: fetchImpl as never })).resolves.toBe(
      true
    )

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/display')
    expect(JSON.parse(init.body as string)).toEqual({
      action: 'heartbeat',
      value: args.displayId,
      route: '/',
    })
  })

  // The invariant: telemetry failures are non-events for the display.
  it('resolves false instead of throwing when the network is down', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })

    await expect(postDisplayHeartbeat({ ...args, fetchImpl: fetchImpl as never })).resolves.toBe(
      false
    )
  })

  it('resolves false on a server error', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 500 }) as Response)

    await expect(postDisplayHeartbeat({ ...args, fetchImpl: fetchImpl as never })).resolves.toBe(
      false
    )
  })

  it('gives up on a hung endpoint instead of leaving the request open', async () => {
    const fetchImpl = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new Error('aborted')))
        })
    )

    await expect(
      postDisplayHeartbeat({ ...args, timeoutMs: 5, fetchImpl: fetchImpl as never })
    ).resolves.toBe(false)
  })
})
