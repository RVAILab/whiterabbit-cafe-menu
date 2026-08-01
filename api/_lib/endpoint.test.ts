/**
 * End-to-end test of `POST /api/display` — the real handler, a faked Sanity
 * client, and a *real* HTTP round trip to a local stub of the Observatory
 * ingest API. This is the closest thing to live verification available until
 * OBSERVATORY_INGEST_TOKEN is provisioned (agent-observatory#11).
 */
import { createServer, type Server } from 'node:http'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { livenessDocId, runIdForDay, utcDay } from './displayLiveness'

const state = vi.hoisted(() => ({
  docs: new Map<string, Record<string, unknown>>(),
  failWrites: false,
  writeCount: 0,
}))

vi.mock('@sanity/client', () => {
  const guard = () => {
    state.writeCount += 1
    if (state.failWrites) throw new Error('sanity unavailable')
  }
  const client = {
    async getDocument(id: string) {
      const doc = state.docs.get(id)
      return doc ? structuredClone(doc) : undefined
    },
    async createIfNotExists(doc: Record<string, unknown>) {
      guard()
      const id = doc._id as string
      if (!state.docs.has(id)) state.docs.set(id, structuredClone(doc))
      return state.docs.get(id)
    },
    patch(id: string) {
      const ops: ((doc: Record<string, unknown>) => void)[] = []
      const chain = {
        setIfMissing(attrs: Record<string, unknown>) {
          ops.push((doc) => {
            for (const [k, v] of Object.entries(attrs)) if (doc[k] === undefined) doc[k] = v
          })
          return chain
        },
        set(attrs: Record<string, unknown>) {
          ops.push((doc) => Object.assign(doc, attrs))
          return chain
        },
        unset(paths: string[]) {
          ops.push((doc) => {
            for (const path of paths) {
              const key = /^displays\[_key=="(.+)"\]$/.exec(path)?.[1]
              const displays = (doc.displays as { _key: string }[]) ?? []
              doc.displays = displays.filter((entry) => entry._key !== key)
            }
          })
          return chain
        },
        insert(_position: string, _path: string, items: unknown[]) {
          ops.push((doc) => {
            doc.displays = [...((doc.displays as unknown[]) ?? []), ...items]
          })
          return chain
        },
        async commit() {
          guard()
          const doc = state.docs.get(id)
          if (!doc) throw new Error(`patch on missing document ${id}`)
          for (const op of ops) op(doc)
          return structuredClone(doc)
        },
      }
      return chain
    },
    async delete() {
      guard()
      return {}
    },
    async createOrReplace(doc: Record<string, unknown>) {
      guard()
      state.docs.set(doc._id as string, structuredClone(doc))
      return doc
    },
  }
  return { createClient: () => client }
})

const { default: handler } = await import('../display')

const DISPLAY_A = '11111111-2222-4333-8444-555555555555'
const DISPLAY_B = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'

interface StubResponse {
  statusCode: number
  body: unknown
}

function mockReq(body: unknown, headers: Record<string, string> = {}) {
  return { method: 'POST', headers, body } as never
}

function mockRes(): StubResponse & { setHeader: () => void; status: (c: number) => unknown } {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    setHeader: () => {},
    status(code: number) {
      res.statusCode = code
      return res
    },
    json(payload: unknown) {
      res.body = payload
      return res
    },
    end() {
      return res
    },
  }
  return res as never
}

// --- local stub of the Observatory ingest API -------------------------------
let server: Server
let baseUrl: string
let received: { auth?: string; body: Record<string, unknown> }[] = []
let ingestStatus = 200

beforeAll(async () => {
  server = createServer((req, res) => {
    let raw = ''
    req.on('data', (chunk) => (raw += chunk))
    req.on('end', () => {
      received.push({
        auth: req.headers.authorization,
        body: JSON.parse(raw || '{}'),
      })
      res.writeHead(ingestStatus, { 'content-type': 'application/json' })
      res.end(JSON.stringify(ingestStatus === 200 ? { ok: true } : { error: 'nope' }))
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  baseUrl = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`
})

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()))
})

beforeEach(() => {
  state.docs.clear()
  state.failWrites = false
  state.writeCount = 0
  received = []
  ingestStatus = 200
  process.env.OBSERVATORY_URL = baseUrl
  process.env.OBSERVATORY_INGEST_TOKEN = 'test-ingest-token'
  delete process.env.DISPLAY_API_KEY
})

afterEach(() => {
  delete process.env.OBSERVATORY_URL
  delete process.env.OBSERVATORY_INGEST_TOKEN
  delete process.env.DISPLAY_API_KEY
})

const today = () => utcDay(new Date())

describe('POST /api/display — heartbeat', () => {
  it('records a display and posts the day roll-up to the Observatory', async () => {
    const res = mockRes()

    await handler(mockReq({ action: 'heartbeat', value: DISPLAY_A, route: '/' }), res as never)

    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({ ok: true, tracked: true, displayCount: 1, emitted: true })

    expect(received).toHaveLength(1)
    expect(received[0].auth).toBe('Bearer test-ingest-token')
    expect(received[0].body).toMatchObject({
      runId: runIdForDay(today()),
      agent: 'cafe-menu-displays',
      status: 'ok',
      meta: { displayCount: 1, app: 'whiterabbit-cafe-menu' },
    })
  })

  it('aggregates displays into one run record — same runId, growing count', async () => {
    await handler(mockReq({ action: 'heartbeat', value: DISPLAY_A, route: '/' }), mockRes() as never)
    await handler(
      mockReq({ action: 'heartbeat', value: DISPLAY_B, route: '/projection' }),
      mockRes() as never
    )

    expect(received.map((r) => r.body.runId)).toEqual([runIdForDay(today()), runIdForDay(today())])
    expect(received.map((r) => (r.body.meta as { displayCount: number }).displayCount)).toEqual([
      1, 2,
    ])
    expect(state.docs.get(livenessDocId(today()))?.displays).toHaveLength(2)
  })

  it('is not gated on DISPLAY_API_KEY — a board holds no secret', async () => {
    process.env.DISPLAY_API_KEY = 'super-secret'
    const res = mockRes()

    await handler(mockReq({ action: 'heartbeat', value: DISPLAY_A, route: '/' }), res as never)

    expect(res.statusCode).toBe(200)
  })

  it('leaves the remote-control command surface authenticated', async () => {
    process.env.DISPLAY_API_KEY = 'super-secret'
    const res = mockRes()

    await handler(mockReq({ action: 'overlay', value: 'sleep' }), res as never)

    expect(res.statusCode).toBe(401)
    expect(received).toHaveLength(0)
  })

  it('rejects a malformed heartbeat without writing anything', async () => {
    const res = mockRes()

    await handler(mockReq({ action: 'heartbeat', value: 'nope', route: '/' }), res as never)

    expect(res.statusCode).toBe(400)
    expect(state.writeCount).toBe(0)
    expect(received).toHaveLength(0)
  })

  it('does nothing at all until the Observatory is provisioned', async () => {
    delete process.env.OBSERVATORY_URL
    delete process.env.OBSERVATORY_INGEST_TOKEN
    const res = mockRes()

    await handler(mockReq({ action: 'heartbeat', value: DISPLAY_A, route: '/' }), res as never)

    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({ ok: true, tracked: false })
    expect(state.writeCount).toBe(0)
  })

  // The invariant: whatever breaks, the board is told nothing is wrong.
  it('answers 200 when the Observatory is unreachable', async () => {
    process.env.OBSERVATORY_URL = 'http://127.0.0.1:1'
    const res = mockRes()

    await handler(mockReq({ action: 'heartbeat', value: DISPLAY_A, route: '/' }), res as never)

    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({ ok: true, displayCount: 1, emitted: false })
  })

  it('answers 200 when the Observatory rejects the post', async () => {
    ingestStatus = 500
    const res = mockRes()

    await handler(mockReq({ action: 'heartbeat', value: DISPLAY_A, route: '/' }), res as never)

    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({ emitted: false })
  })

  it('answers 200 when Sanity itself is down', async () => {
    state.failWrites = true
    const res = mockRes()

    await handler(mockReq({ action: 'heartbeat', value: DISPLAY_A, route: '/' }), res as never)

    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({ ok: true, tracked: false })
  })

  it('retries the same runId after a failed post, then succeeds', async () => {
    ingestStatus = 500
    await handler(mockReq({ action: 'heartbeat', value: DISPLAY_A, route: '/' }), mockRes() as never)

    ingestStatus = 200
    const res = mockRes()
    await handler(mockReq({ action: 'heartbeat', value: DISPLAY_A, route: '/' }), res as never)

    expect(received).toHaveLength(2)
    expect(received[1].body.runId).toBe(received[0].body.runId)
    expect(res.body).toMatchObject({ emitted: true, displayCount: 1 })
  })
})
