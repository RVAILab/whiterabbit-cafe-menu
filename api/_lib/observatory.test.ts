import { describe, expect, it, vi } from 'vitest'
import { isObservatoryConfigured, recordRun, type RunRecord } from './observatory'

const ENV = { OBSERVATORY_URL: 'https://obs.example.com', OBSERVATORY_INGEST_TOKEN: 'tok' }

const record: RunRecord = {
  runId: 'cafe-menu-displays-2026-08-01',
  agent: 'cafe-menu-displays',
  status: 'ok',
  startedAt: '2026-08-01T14:00:00.000Z',
  finishedAt: '2026-08-01T20:00:00.000Z',
  meta: { displayCount: 3 },
}

const okResponse = () =>
  ({ ok: true, status: 200, json: async () => ({ ok: true }) }) as unknown as Response

describe('recordRun', () => {
  it('posts a contract-v1 run record with bearer auth', async () => {
    const fetchImpl = vi.fn(async () => okResponse())

    const outcome = await recordRun(record, { env: ENV, fetchImpl: fetchImpl as never })

    expect(outcome).toBe('posted')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://obs.example.com/api/runs')
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer tok')
    expect(JSON.parse(init.body as string)).toMatchObject({
      runId: 'cafe-menu-displays-2026-08-01',
      agent: 'cafe-menu-displays',
      status: 'ok',
      startedAt: '2026-08-01T14:00:00.000Z',
      finishedAt: '2026-08-01T20:00:00.000Z',
      meta: { displayCount: 3 },
    })
  })

  it('sends only fields the strict ingest schema accepts', async () => {
    const fetchImpl = vi.fn(async () => okResponse())
    await recordRun(record, { env: ENV, fetchImpl: fetchImpl as never })

    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    const allowed = new Set([
      'runId',
      'agent',
      'status',
      'startedAt',
      'finishedAt',
      'exitCode',
      'summary',
      'host',
      'runtime',
      'costUsd',
      'tokensIn',
      'tokensOut',
      'logUrl',
      'meta',
    ])
    for (const key of Object.keys(JSON.parse(init.body as string))) {
      expect(allowed.has(key), `unexpected key ${key}`).toBe(true)
    }
  })

  // The invariant: nothing below may throw into the caller.
  it('is a silent no-op with no token — and never calls fetch', async () => {
    const fetchImpl = vi.fn(async () => okResponse())

    const outcome = await recordRun(record, {
      env: { OBSERVATORY_URL: ENV.OBSERVATORY_URL },
      fetchImpl: fetchImpl as never,
    })

    expect(outcome).toBe('skipped')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('is a silent no-op with no Observatory URL', async () => {
    const fetchImpl = vi.fn(async () => okResponse())
    const outcome = await recordRun(record, {
      env: { OBSERVATORY_INGEST_TOKEN: 'tok' },
      fetchImpl: fetchImpl as never,
    })
    expect(outcome).toBe('skipped')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('swallows an unreachable Observatory', async () => {
    const warn = vi.fn()
    const fetchImpl = vi.fn(async () => {
      throw new Error('getaddrinfo ENOTFOUND obs.example.com')
    })

    await expect(
      recordRun(record, { env: ENV, fetchImpl: fetchImpl as never, warn })
    ).resolves.toBe('failed')
    expect(warn).toHaveBeenCalled()
  })

  it('swallows a non-200 response', async () => {
    const warn = vi.fn()
    const fetchImpl = vi.fn(
      async () => ({ ok: false, status: 500, json: async () => ({}) }) as unknown as Response
    )

    await expect(
      recordRun(record, { env: ENV, fetchImpl: fetchImpl as never, warn })
    ).resolves.toBe('failed')
    expect(warn).toHaveBeenCalled()
  })

  it('swallows a 200 that is not an ingest acknowledgement', async () => {
    const fetchImpl = vi.fn(
      async () => ({ ok: true, status: 200, json: async () => ({ nope: 1 }) }) as unknown as Response
    )
    await expect(
      recordRun(record, { env: ENV, fetchImpl: fetchImpl as never, warn: vi.fn() })
    ).resolves.toBe('failed')
  })

  it('aborts a hung Observatory rather than hanging with it', async () => {
    const fetchImpl = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new Error('aborted')))
        })
    )

    const outcome = await recordRun(record, {
      env: ENV,
      fetchImpl: fetchImpl as never,
      timeoutMs: 5,
      warn: vi.fn(),
    })

    expect(outcome).toBe('failed')
  })

  it('drops a record whose agent slug the ingest API would reject', async () => {
    const fetchImpl = vi.fn(async () => okResponse())
    const outcome = await recordRun(
      { ...record, agent: 'Cafe Menu Displays' },
      { env: ENV, fetchImpl: fetchImpl as never, warn: vi.fn() }
    )
    expect(outcome).toBe('skipped')
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

describe('isObservatoryConfigured', () => {
  it('is true only when both env vars are present', () => {
    expect(isObservatoryConfigured(ENV)).toBe(true)
    expect(isObservatoryConfigured({ OBSERVATORY_URL: 'x' })).toBe(false)
    expect(isObservatoryConfigured({ OBSERVATORY_INGEST_TOKEN: 'x' })).toBe(false)
    expect(isObservatoryConfigured({})).toBe(false)
  })
})
