import { describe, expect, it, vi } from 'vitest'
import {
  AGENT_SLUG,
  EMIT_MIN_INTERVAL_MS,
  EXPECTED_HEARTBEAT_INTERVAL_MS,
  LIVENESS_DOC_TYPE,
  MAX_DISPLAYS_PER_DAY,
  MIN_PRESENCE_BEATS,
  MIN_PRESENCE_MS,
  buildRunRecord,
  evictionCandidate,
  handleHeartbeat,
  isSustainedDisplay,
  livenessDocId,
  parseHeartbeat,
  retentionCutoffDay,
  runIdForDay,
  shouldEmit,
  trackHeartbeat,
  utcDay,
  type DisplayEntry,
  type HeartbeatResult,
  type LivenessClient,
  type LivenessDoc,
  type LivenessPatch,
} from './displayLiveness'
import type { RecordRunOutcome, RunRecord } from './observatory'

type Doc = Record<string, unknown>

/** In-memory stand-in for the Sanity client, honouring the operations used. */
class FakeSanity implements LivenessClient {
  docs = new Map<string, Doc>()
  deletes: { query: string; params?: Record<string, unknown> }[] = []

  async getDocument(id: string) {
    const doc = this.docs.get(id)
    return doc ? structuredClone(doc) : undefined
  }

  async createIfNotExists(doc: Doc) {
    const id = doc._id as string
    if (!this.docs.has(id)) this.docs.set(id, structuredClone(doc))
    return structuredClone(this.docs.get(id)!)
  }

  patch(id: string): LivenessPatch {
    const ops: ((doc: Doc) => void)[] = []
    const store = this.docs
    const chain: LivenessPatch = {
      setIfMissing(attrs) {
        ops.push((doc) => {
          for (const [key, value] of Object.entries(attrs)) {
            if (doc[key] === undefined) doc[key] = value
          }
        })
        return chain
      },
      set(attrs) {
        ops.push((doc) => Object.assign(doc, attrs))
        return chain
      },
      unset(paths) {
        ops.push((doc) => {
          for (const path of paths) {
            const match = /^displays\[_key=="(.+)"\]$/.exec(path)
            if (!match) throw new Error(`unsupported unset path: ${path}`)
            const displays = (doc.displays as { _key: string }[] | undefined) ?? []
            doc.displays = displays.filter((entry) => entry._key !== match[1])
          }
        })
        return chain
      },
      insert(position, path, items) {
        ops.push((doc) => {
          if (position !== 'after' || path !== 'displays[-1]') {
            throw new Error(`unsupported insert: ${position} ${path}`)
          }
          const displays = (doc.displays as unknown[] | undefined) ?? []
          doc.displays = [...displays, ...items]
        })
        return chain
      },
      async commit() {
        const doc = store.get(id)
        if (!doc) throw new Error(`patch on missing document ${id}`)
        for (const op of ops) op(doc)
        return structuredClone(doc)
      },
    }
    return chain
  }

  async delete(selection: { query: string; params?: Record<string, unknown> }) {
    this.deletes.push(selection)
    const cutoff = selection.params?.cutoff as string | undefined
    if (cutoff) {
      for (const [id, doc] of this.docs) {
        if ((doc.day as string) < cutoff) this.docs.delete(id)
      }
    }
    return {}
  }
}

const at = (iso: string) => new Date(iso)
const DISPLAY_A = '11111111-2222-4333-8444-555555555555'
const DISPLAY_B = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const BEAT_MS = EXPECTED_HEARTBEAT_INTERVAL_MS
const OPEN = Date.parse('2026-08-01T14:00:00.000Z')

function poster() {
  const posted: RunRecord[] = []
  const post = vi.fn(async (record: RunRecord): Promise<RecordRunOutcome> => {
    posted.push(record)
    return 'posted'
  })
  return { posted, post }
}

/** A display beating on the real interval, as the player does. */
async function playBeats(
  client: LivenessClient,
  post: (record: RunRecord) => Promise<RecordRunOutcome>,
  options: { id: string; route?: string; from?: number; beats: number; stepMs?: number }
): Promise<HeartbeatResult> {
  const { id, route = '/', from = OPEN, beats, stepMs = BEAT_MS } = options
  let last: HeartbeatResult | undefined
  for (let i = 0; i < beats; i += 1) {
    last = await handleHeartbeat(
      { client, post, now: new Date(from + i * stepMs), warn: vi.fn() },
      { displayId: id, route }
    )
  }
  return last!
}

/** Synthetic entries for the pure predicates. */
function entry(overrides: Partial<DisplayEntry> & { _key: string }): DisplayEntry {
  const firstSeenAt = overrides.firstSeenAt ?? new Date(OPEN).toISOString()
  return {
    route: '/',
    beats: MIN_PRESENCE_BEATS + 1,
    firstSeenAt,
    lastSeenAt: new Date(Date.parse(firstSeenAt) + MIN_PRESENCE_MS).toISOString(),
    ...overrides,
  }
}

/** An id that qualified: a full session's worth of beats over hours. */
const board = (key: string) =>
  entry({ _key: key, beats: 49, lastSeenAt: new Date(OPEN + 8 * 60 * 60 * 1000).toISOString() })

/** An id that did not: a browser open for twenty minutes. */
const viewer = (key: string) =>
  entry({ _key: key, beats: 2, lastSeenAt: new Date(OPEN + 20 * 60 * 1000).toISOString() })

describe('day keying', () => {
  it('derives one doc id and one runId per UTC day', () => {
    expect(utcDay(at('2026-08-01T23:59:59.999Z'))).toBe('2026-08-01')
    expect(livenessDocId('2026-08-01')).toBe(`${LIVENESS_DOC_TYPE}.2026-08-01`)
    expect(runIdForDay('2026-08-01')).toBe(`${AGENT_SLUG}-2026-08-01`)
  })

  it('rolls over at midnight UTC', () => {
    expect(utcDay(at('2026-08-01T23:59:59.999Z'))).toBe('2026-08-01')
    expect(utcDay(at('2026-08-02T00:00:00.000Z'))).toBe('2026-08-02')
    expect(runIdForDay(utcDay(at('2026-08-01T23:59:59.999Z')))).not.toBe(
      runIdForDay(utcDay(at('2026-08-02T00:00:00.000Z')))
    )
  })

  it('computes a retention cutoff a fortnight back', () => {
    expect(retentionCutoffDay(at('2026-08-15T04:00:00.000Z'))).toBe('2026-08-01')
  })
})

describe('parseHeartbeat', () => {
  it('accepts a display id on a display route', () => {
    expect(parseHeartbeat({ action: 'heartbeat', value: DISPLAY_A, route: '/projection' })).toEqual({
      value: { displayId: DISPLAY_A, route: '/projection' },
      error: null,
    })
  })

  it.each([
    ['no body', undefined],
    ['no value', { route: '/' }],
    ['short id', { value: 'abc', route: '/' }],
    ['id with a quote', { value: `a"] || *[_type=="x`, route: '/' }],
    ['uppercase id', { value: DISPLAY_B.toUpperCase(), route: '/' }],
  ])('rejects %s', (_label, body) => {
    const parsed = parseHeartbeat(body)
    expect(parsed.value).toBeNull()
    expect(parsed.error).toBeTruthy()
  })

  it('rejects routes that are not ambient displays', () => {
    expect(parseHeartbeat({ value: DISPLAY_A, route: '/print' }).value).toBeNull()
    expect(parseHeartbeat({ value: DISPLAY_A, route: '/print-light' }).value).toBeNull()
  })
})

// The count answers "are the boards up". Nothing but a board may satisfy it,
// and every board must.
describe('isSustainedDisplay', () => {
  it('counts a board that ran a full session', () => {
    expect(isSustainedDisplay(board(DISPLAY_A))).toBe(true)
  })

  it('does not count a browser open for twenty minutes', () => {
    expect(isSustainedDisplay(viewer(DISPLAY_B))).toBe(false)
  })

  it('does not count a browser opened twice hours apart', () => {
    // Wide span, two beats — a regular checking the menu, not a board.
    expect(
      isSustainedDisplay(
        entry({
          _key: DISPLAY_B,
          beats: 2,
          lastSeenAt: new Date(OPEN + 7 * 60 * 60 * 1000).toISOString(),
        })
      )
    ).toBe(false)
  })

  it('does not count a burst of beats that ignored the interval', () => {
    expect(
      isSustainedDisplay(
        entry({
          _key: DISPLAY_B,
          beats: 200,
          lastSeenAt: new Date(OPEN + 30 * 1000).toISOString(),
        })
      )
    ).toBe(false)
  })

  // Both edges, exactly.
  it('qualifies at exactly the threshold', () => {
    expect(
      isSustainedDisplay(
        entry({
          _key: DISPLAY_A,
          beats: MIN_PRESENCE_BEATS,
          lastSeenAt: new Date(OPEN + MIN_PRESENCE_MS).toISOString(),
        })
      )
    ).toBe(true)
  })

  it('does not qualify one millisecond short of the span', () => {
    expect(
      isSustainedDisplay(
        entry({
          _key: DISPLAY_A,
          beats: MIN_PRESENCE_BEATS,
          lastSeenAt: new Date(OPEN + MIN_PRESENCE_MS - 1).toISOString(),
        })
      )
    ).toBe(false)
  })

  it('does not qualify one beat short', () => {
    expect(
      isSustainedDisplay(
        entry({
          _key: DISPLAY_A,
          beats: MIN_PRESENCE_BEATS - 1,
          lastSeenAt: new Date(OPEN + 6 * 60 * 60 * 1000).toISOString(),
        })
      )
    ).toBe(false)
  })

  it('rejects a malformed or missing entry rather than guessing', () => {
    expect(isSustainedDisplay(undefined)).toBe(false)
    expect(
      isSustainedDisplay({
        _key: DISPLAY_A,
        route: '/',
        beats: 99,
        firstSeenAt: 'not-a-date',
        lastSeenAt: new Date(OPEN).toISOString(),
      })
    ).toBe(false)
  })
})

describe('trackHeartbeat', () => {
  it('keeps first-seen and accumulates beats across a session', async () => {
    const client = new FakeSanity()

    await trackHeartbeat(client, { displayId: DISPLAY_A, route: '/' }, at('2026-08-01T14:00:00Z'))
    const second = await trackHeartbeat(
      client,
      { displayId: DISPLAY_A, route: '/' },
      at('2026-08-01T14:10:00Z')
    )

    expect(second.doc.displays).toHaveLength(1)
    expect(second.doc.displays?.[0]).toMatchObject({
      _key: DISPLAY_A,
      firstSeenAt: '2026-08-01T14:00:00.000Z',
      lastSeenAt: '2026-08-01T14:10:00.000Z',
      beats: 2,
    })
    expect(second.isNewDay).toBe(false)
  })

  it('tracks distinct displays separately', async () => {
    const client = new FakeSanity()
    await trackHeartbeat(client, { displayId: DISPLAY_A, route: '/' }, at('2026-08-01T14:00:00Z'))
    const result = await trackHeartbeat(
      client,
      { displayId: DISPLAY_B, route: '/projection' },
      at('2026-08-01T14:01:00Z')
    )

    expect(result.doc.displays?.map((d) => d._key)).toEqual([DISPLAY_A, DISPLAY_B])
  })

  it('refuses a display id that could escape the Sanity selector', async () => {
    const client = new FakeSanity()
    await expect(
      trackHeartbeat(client, { displayId: 'a"]', route: '/' }, at('2026-08-01T14:00:00Z'))
    ).rejects.toThrow(/invalid display id/)
  })
})

// A full document must never be able to shut a real board out.
describe('eviction at the tracking cap', () => {
  const fill = (client: FakeSanity, day: string, displays: DisplayEntry[]) => {
    client.docs.set(livenessDocId(day), {
      _id: livenessDocId(day),
      _type: LIVENESS_DOC_TYPE,
      day,
      startedAt: new Date(OPEN).toISOString(),
      lastSeenAt: new Date(OPEN).toISOString(),
      displays,
    })
  }

  it('drops the least-present unqualified entry, never a qualified one', () => {
    const displays = [
      board('board0000-0000-4000-8000-000000000000'),
      entry({ _key: 'busy0000-0000-4000-8000-000000000000', beats: 9 }),
      entry({ _key: 'quiet000-0000-4000-8000-000000000000', beats: 1 }),
    ]

    expect(evictionCandidate(displays)?._key).toBe('quiet000-0000-4000-8000-000000000000')
  })

  it('breaks ties on the oldest last-seen', () => {
    const displays = [
      entry({
        _key: 'newer000-0000-4000-8000-000000000000',
        beats: 1,
        lastSeenAt: '2026-08-01T16:00:00.000Z',
      }),
      entry({
        _key: 'older000-0000-4000-8000-000000000000',
        beats: 1,
        lastSeenAt: '2026-08-01T15:00:00.000Z',
      }),
    ]

    expect(evictionCandidate(displays)?._key).toBe('older000-0000-4000-8000-000000000000')
  })

  it('evicts nothing when every tracked id has qualified', () => {
    expect(evictionCandidate([board(DISPLAY_A), board(DISPLAY_B)])).toBeNull()
  })

  it('makes room for a board arriving at a document full of passing browsers', async () => {
    const client = new FakeSanity()
    const viewers = Array.from({ length: MAX_DISPLAYS_PER_DAY }, (_, i) =>
      viewer(`${String(i).padStart(2, '0')}000000-0000-4000-8000-000000000000`)
    )
    fill(client, '2026-08-01', viewers)

    const result = await trackHeartbeat(
      client,
      { displayId: DISPLAY_A, route: '/' },
      at('2026-08-01T18:00:00Z')
    )

    expect(result.capped).toBe(false)
    expect(result.doc.displays).toHaveLength(MAX_DISPLAYS_PER_DAY)
    expect(result.doc.displays?.some((d) => d._key === DISPLAY_A)).toBe(true)
  })

  it('holds the line when the document is full of real boards', async () => {
    const client = new FakeSanity()
    const boards = Array.from({ length: MAX_DISPLAYS_PER_DAY }, (_, i) =>
      board(`${String(i).padStart(2, '0')}000000-0000-4000-8000-000000000000`)
    )
    fill(client, '2026-08-01', boards)

    const result = await trackHeartbeat(
      client,
      { displayId: DISPLAY_A, route: '/' },
      at('2026-08-01T18:00:00Z')
    )

    expect(result.capped).toBe(true)
    expect(result.doc.displays).toHaveLength(MAX_DISPLAYS_PER_DAY)
  })
})

describe('shouldEmit', () => {
  const now = at('2026-08-01T22:00:00Z')

  it('does not emit with nothing to report', () => {
    expect(shouldEmit({ displays: [] }, now)).toBe(false)
  })

  it('does not emit for tracked ids that are not displays', () => {
    expect(shouldEmit({ displays: [viewer(DISPLAY_B)] }, now)).toBe(false)
  })

  it('emits the first time a display qualifies', () => {
    expect(shouldEmit({ displays: [board(DISPLAY_A)] }, now)).toBe(true)
  })

  it('emits immediately when the count moves', () => {
    expect(
      shouldEmit(
        {
          displays: [board(DISPLAY_A), board(DISPLAY_B)],
          emittedCount: 1,
          emittedAt: '2026-08-01T21:59:00Z',
        },
        now
      )
    ).toBe(true)
  })

  it('throttles an unchanged count', () => {
    expect(
      shouldEmit(
        { displays: [board(DISPLAY_A)], emittedCount: 1, emittedAt: '2026-08-01T21:59:00Z' },
        now
      )
    ).toBe(false)
  })

  it('refreshes an unchanged count once the last emit goes stale', () => {
    expect(
      shouldEmit(
        {
          displays: [board(DISPLAY_A)],
          emittedCount: 1,
          emittedAt: new Date(now.getTime() - EMIT_MIN_INTERVAL_MS).toISOString(),
        },
        now
      )
    ).toBe(true)
  })
})

describe('buildRunRecord', () => {
  it('counts and lists only sustained displays, tallying the rest as pending', () => {
    const doc: LivenessDoc = {
      _id: livenessDocId('2026-08-01'),
      _type: LIVENESS_DOC_TYPE,
      day: '2026-08-01',
      startedAt: '2026-08-01T13:00:00.000Z',
      lastSeenAt: '2026-08-01T22:30:00.000Z',
      displays: [viewer(DISPLAY_B), board(DISPLAY_A)],
    }

    const record = buildRunRecord(doc)

    expect(record.runId).toBe('cafe-menu-displays-2026-08-01')
    expect(record.agent).toBe(AGENT_SLUG)
    expect(record.status).toBe('ok')
    expect(record.meta?.displayCount).toBe(1)
    expect(record.meta?.pending).toBe(1)
    expect((record.meta?.displays as { id: string }[]).map((d) => d.id)).toEqual([DISPLAY_A])
    expect(record.summary).toBe('1 display reporting on 2026-08-01')
    expect(utcDay(new Date(record.startedAt))).toBe('2026-08-01')
    expect(utcDay(new Date(record.finishedAt))).toBe('2026-08-01')
  })

  it('starts the run at the first qualified display, not at the first stray beat', () => {
    const doc: LivenessDoc = {
      _id: livenessDocId('2026-08-01'),
      _type: LIVENESS_DOC_TYPE,
      day: '2026-08-01',
      startedAt: '2026-08-01T02:00:00.000Z', // a passer-by in the small hours
      lastSeenAt: '2026-08-01T22:30:00.000Z',
      displays: [board(DISPLAY_A)],
    }

    expect(buildRunRecord(doc).startedAt).toBe(new Date(OPEN).toISOString())
  })
})

describe('handleHeartbeat', () => {
  it('counts a board that runs a normal session', async () => {
    const client = new FakeSanity()
    const { posted, post } = poster()

    // 14:00 → 22:00 UTC, beating every ten minutes.
    const result = await playBeats(client, post, { id: DISPLAY_A, beats: 49 })

    expect(result.displayCount).toBe(1)
    expect(result.pending).toBe(0)
    expect(posted.at(-1)?.meta?.displayCount).toBe(1)
  })

  it('counts a board on a short opening day', async () => {
    const client = new FakeSanity()
    const { post } = poster()

    // Four hours — well under a normal session.
    const result = await playBeats(client, post, { id: DISPLAY_A, beats: 25 })

    expect(result.displayCount).toBe(1)
  })

  it('never counts a browser that was open briefly, and posts nothing', async () => {
    const client = new FakeSanity()
    const { posted, post } = poster()

    // Half an hour on the public menu URL.
    const result = await playBeats(client, post, { id: DISPLAY_B, beats: 3 })

    expect(result.displayCount).toBe(0)
    expect(result.pending).toBe(1)
    expect(posted).toHaveLength(0)
  })

  it('reports the board and ignores the browser sitting next to it', async () => {
    const client = new FakeSanity()
    const { posted, post } = poster()

    await playBeats(client, post, { id: DISPLAY_B, beats: 4 }) // a customer's laptop
    const result = await playBeats(client, post, { id: DISPLAY_A, beats: 49 }) // the board

    expect(result.displayCount).toBe(1)
    expect(result.pending).toBe(1)
    expect(posted.at(-1)?.meta?.displayCount).toBe(1)
    expect((posted.at(-1)?.meta?.displays as { id: string }[]).map((d) => d.id)).toEqual([DISPLAY_A])
  })

  it('starts counting at the exact beat that clears the threshold', async () => {
    const client = new FakeSanity()
    const { post } = poster()

    const short = await playBeats(client, post, { id: DISPLAY_A, beats: MIN_PRESENCE_BEATS })
    expect(short.displayCount).toBe(0) // 12 beats spans 110 minutes — not yet

    const cleared = await playBeats(client, post, {
      id: DISPLAY_A,
      beats: 1,
      from: OPEN + MIN_PRESENCE_BEATS * BEAT_MS,
    })
    expect(cleared.displayCount).toBe(1) // 13 beats spans exactly two hours
  })

  it('emits one run record per day, upserting the same runId as boards qualify', async () => {
    const client = new FakeSanity()
    const { posted, post } = poster()

    await playBeats(client, post, { id: DISPLAY_A, beats: 49 })
    await playBeats(client, post, { id: DISPLAY_B, route: '/projection', beats: 49 })

    expect(new Set(posted.map((r) => r.runId))).toEqual(new Set(['cafe-menu-displays-2026-08-01']))
    expect(posted.at(-1)?.meta?.displayCount).toBe(2)
  })

  it('is idempotent on a retry — same runId, no duplicate display', async () => {
    const client = new FakeSanity()
    const { posted, post } = poster()

    await playBeats(client, post, { id: DISPLAY_A, beats: 49 })
    const before = posted.length

    // The board retries a beat it never saw acknowledged.
    const retry = await handleHeartbeat(
      { client, post, now: new Date(OPEN + 48 * BEAT_MS + 5000) },
      { displayId: DISPLAY_A, route: '/' }
    )

    expect(retry.displayCount).toBe(1)
    expect(posted).toHaveLength(before) // throttled: nothing changed
    expect(client.docs.get(livenessDocId('2026-08-01'))?.displays).toHaveLength(1)

    // Even forced past the throttle, the key is unchanged.
    const later = await handleHeartbeat(
      { client, post, now: new Date(OPEN + 9 * 60 * 60 * 1000) },
      { displayId: DISPLAY_A, route: '/' }
    )
    expect(later.displayCount).toBe(1)
    expect(posted.at(-1)?.runId).toBe(posted[0].runId)
  })

  it('resets the count at the UTC day boundary', async () => {
    const client = new FakeSanity()
    const { posted, post } = poster()

    // A board qualified on 2026-08-01.
    const yesterday = await playBeats(client, post, {
      id: DISPLAY_A,
      from: Date.parse('2026-08-01T14:00:00.000Z'),
      beats: 49,
    })
    expect(yesterday.day).toBe('2026-08-01')
    expect(yesterday.displayCount).toBe(1)

    // The same board just after midnight UTC: a fresh day, counting from zero.
    const justAfterMidnight = await playBeats(client, post, {
      id: DISPLAY_A,
      from: Date.parse('2026-08-02T00:05:00.000Z'),
      beats: 3,
    })
    expect(justAfterMidnight.day).toBe('2026-08-02')
    expect(justAfterMidnight.displayCount).toBe(0)
    expect(justAfterMidnight.pending).toBe(1)

    // …and qualifying again once it has been up long enough.
    const newDay = await playBeats(client, post, {
      id: DISPLAY_A,
      from: Date.parse('2026-08-02T00:35:00.000Z'),
      beats: 20,
    })
    expect(newDay.day).toBe('2026-08-02')
    expect(newDay.displayCount).toBe(1)

    expect(posted.at(-1)?.runId).toBe('cafe-menu-displays-2026-08-02')
    expect(posted.at(-1)?.meta?.displayCount).toBe(1)
    // Yesterday's record is untouched and still says 1.
    expect(
      posted.filter((r) => r.runId === 'cafe-menu-displays-2026-08-01').at(-1)?.meta?.displayCount
    ).toBe(1)
  })

  it('prunes stale day documents on the first beat of a new day only', async () => {
    const client = new FakeSanity()
    const { post } = poster()
    client.docs.set(livenessDocId('2026-07-01'), {
      _id: livenessDocId('2026-07-01'),
      _type: LIVENESS_DOC_TYPE,
      day: '2026-07-01',
    })

    await playBeats(client, post, { id: DISPLAY_A, beats: 1 })
    expect(client.deletes).toHaveLength(1)
    expect(client.docs.has(livenessDocId('2026-07-01'))).toBe(false)

    await playBeats(client, post, { id: DISPLAY_B, beats: 1, from: OPEN + 20 * 60 * 1000 })
    expect(client.deletes).toHaveLength(1)
  })

  // Failure paths — none of these may escalate.
  it('retries with the same runId after a failed post, leaving no emit marker', async () => {
    const client = new FakeSanity()
    const attempts: RunRecord[] = []
    const post = vi.fn(async (record: RunRecord): Promise<RecordRunOutcome> => {
      attempts.push(record)
      return 'failed'
    })

    const first = await playBeats(client, post, { id: DISPLAY_A, beats: MIN_PRESENCE_BEATS + 1 })
    expect(first.emitted).toBe(false)
    expect(attempts).toHaveLength(1)

    // Nothing was marked emitted, so the very next beat tries again — not in
    // 30 minutes' time.
    const second = await playBeats(client, post, {
      id: DISPLAY_A,
      beats: 1,
      from: OPEN + (MIN_PRESENCE_BEATS + 1) * BEAT_MS,
    })
    expect(attempts).toHaveLength(2)
    expect(attempts[1].runId).toBe(attempts[0].runId)
    expect(second.emitted).toBe(false)
  })

  it('does not throw when the Observatory is unreachable', async () => {
    const client = new FakeSanity()
    const post = vi.fn(async () => {
      throw new Error('ECONNREFUSED')
    })

    const result = await playBeats(client, post, { id: DISPLAY_A, beats: MIN_PRESENCE_BEATS + 1 })

    expect(result).toMatchObject({ day: '2026-08-01', displayCount: 1, emitted: false })
  })

  it('does not throw when the Observatory is unconfigured (recordRun skips)', async () => {
    const client = new FakeSanity()
    const post = vi.fn(async (): Promise<RecordRunOutcome> => 'skipped')

    const result = await playBeats(client, post, { id: DISPLAY_A, beats: MIN_PRESENCE_BEATS + 1 })

    expect(result.emitted).toBe(false)
    expect(result.outcome).toBe('skipped')
  })

  it('still reports a heartbeat when pruning fails', async () => {
    const client = new FakeSanity()
    client.delete = async () => {
      throw new Error('sanity down')
    }
    const { post } = poster()

    const result = await playBeats(client, post, { id: DISPLAY_A, beats: MIN_PRESENCE_BEATS + 1 })
    expect(result.displayCount).toBe(1)
  })
})
