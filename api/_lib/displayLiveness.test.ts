import { describe, expect, it, vi } from 'vitest'
import {
  AGENT_SLUG,
  EMIT_MIN_INTERVAL_MS,
  LIVENESS_DOC_TYPE,
  MAX_DISPLAYS_PER_DAY,
  buildRunRecord,
  handleHeartbeat,
  livenessDocId,
  parseHeartbeat,
  retentionCutoffDay,
  runIdForDay,
  shouldEmit,
  trackHeartbeat,
  utcDay,
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

function poster() {
  const posted: RunRecord[] = []
  const post = vi.fn(async (record: RunRecord): Promise<RecordRunOutcome> => {
    posted.push(record)
    return 'posted'
  })
  return { posted, post }
}

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

describe('trackHeartbeat', () => {
  it('records a display once, however many times it beats', async () => {
    const client = new FakeSanity()

    await trackHeartbeat(client, { displayId: DISPLAY_A, route: '/' }, at('2026-08-01T14:00:00Z'))
    const second = await trackHeartbeat(
      client,
      { displayId: DISPLAY_A, route: '/' },
      at('2026-08-01T14:10:00Z')
    )

    expect(second.doc.displays).toHaveLength(1)
    expect(second.doc.displays?.[0].lastSeenAt).toBe('2026-08-01T14:10:00.000Z')
    expect(second.doc.startedAt).toBe('2026-08-01T14:00:00.000Z')
    expect(second.isNewDay).toBe(false)
  })

  it('counts distinct displays', async () => {
    const client = new FakeSanity()
    await trackHeartbeat(client, { displayId: DISPLAY_A, route: '/' }, at('2026-08-01T14:00:00Z'))
    const result = await trackHeartbeat(
      client,
      { displayId: DISPLAY_B, route: '/projection' },
      at('2026-08-01T14:01:00Z')
    )

    expect(result.doc.displays?.map((d) => d._key)).toEqual([DISPLAY_A, DISPLAY_B])
  })

  it('caps how many distinct displays a day can accumulate', async () => {
    const client = new FakeSanity()
    for (let i = 0; i < MAX_DISPLAYS_PER_DAY; i += 1) {
      const id = `${String(i).padStart(2, '0')}000000-0000-4000-8000-000000000000`
      await trackHeartbeat(client, { displayId: id, route: '/' }, at('2026-08-01T14:00:00Z'))
    }

    const overflow = await trackHeartbeat(
      client,
      { displayId: DISPLAY_B, route: '/' },
      at('2026-08-01T14:05:00Z')
    )

    expect(overflow.capped).toBe(true)
    expect(overflow.doc.displays).toHaveLength(MAX_DISPLAYS_PER_DAY)
  })

  it('refuses a display id that could escape the Sanity selector', async () => {
    const client = new FakeSanity()
    await expect(
      trackHeartbeat(client, { displayId: 'a"]', route: '/' }, at('2026-08-01T14:00:00Z'))
    ).rejects.toThrow(/invalid display id/)
  })
})

describe('shouldEmit', () => {
  const now = at('2026-08-01T15:00:00Z')

  it('does not emit with nothing to report', () => {
    expect(shouldEmit({ displays: [] }, now)).toBe(false)
  })

  it('emits the first time a count exists', () => {
    expect(shouldEmit({ displays: [{ _key: 'a', route: '/', lastSeenAt: '' }] }, now)).toBe(true)
  })

  it('emits immediately when the count moves', () => {
    expect(
      shouldEmit(
        {
          displays: [
            { _key: 'a', route: '/', lastSeenAt: '' },
            { _key: 'b', route: '/', lastSeenAt: '' },
          ],
          emittedCount: 1,
          emittedAt: '2026-08-01T14:59:00Z',
        },
        now
      )
    ).toBe(true)
  })

  it('throttles an unchanged count', () => {
    expect(
      shouldEmit(
        {
          displays: [{ _key: 'a', route: '/', lastSeenAt: '' }],
          emittedCount: 1,
          emittedAt: '2026-08-01T14:59:00Z',
        },
        now
      )
    ).toBe(false)
  })

  it('refreshes an unchanged count once the last emit goes stale', () => {
    expect(
      shouldEmit(
        {
          displays: [{ _key: 'a', route: '/', lastSeenAt: '' }],
          emittedCount: 1,
          emittedAt: new Date(now.getTime() - EMIT_MIN_INTERVAL_MS).toISOString(),
        },
        now
      )
    ).toBe(true)
  })
})

describe('buildRunRecord', () => {
  it('carries the display count in meta and stays inside its own UTC day', () => {
    const doc: LivenessDoc = {
      _id: livenessDocId('2026-08-01'),
      _type: LIVENESS_DOC_TYPE,
      day: '2026-08-01',
      startedAt: '2026-08-01T14:00:00.000Z',
      lastSeenAt: '2026-08-01T22:30:00.000Z',
      displays: [
        { _key: DISPLAY_A, route: '/', lastSeenAt: '2026-08-01T22:30:00.000Z' },
        { _key: DISPLAY_B, route: '/projection', lastSeenAt: '2026-08-01T22:20:00.000Z' },
      ],
    }

    const record = buildRunRecord(doc)

    expect(record.runId).toBe('cafe-menu-displays-2026-08-01')
    expect(record.agent).toBe(AGENT_SLUG)
    expect(record.status).toBe('ok')
    expect(record.meta?.displayCount).toBe(2)
    expect(record.summary).toBe('2 displays reporting on 2026-08-01')
    expect(utcDay(new Date(record.startedAt))).toBe('2026-08-01')
    expect(utcDay(new Date(record.finishedAt))).toBe('2026-08-01')
  })
})

describe('handleHeartbeat', () => {
  it('emits one run record per day, upserting the same runId as displays arrive', async () => {
    const client = new FakeSanity()
    const { posted, post } = poster()

    await handleHeartbeat(
      { client, post, now: at('2026-08-01T14:00:00Z') },
      { displayId: DISPLAY_A, route: '/' }
    )
    await handleHeartbeat(
      { client, post, now: at('2026-08-01T14:01:00Z') },
      { displayId: DISPLAY_B, route: '/projection' }
    )

    expect(posted).toHaveLength(2)
    // Same idempotency key: the Observatory upserts, so the day has one record.
    expect(new Set(posted.map((r) => r.runId))).toEqual(new Set(['cafe-menu-displays-2026-08-01']))
    expect(posted.map((r) => r.meta?.displayCount)).toEqual([1, 2])
  })

  it('is idempotent on a retry — same runId, no duplicate display', async () => {
    const client = new FakeSanity()
    const { posted, post } = poster()

    // The board retries the same heartbeat after a timeout it never saw resolve.
    await handleHeartbeat(
      { client, post, now: at('2026-08-01T14:00:00Z') },
      { displayId: DISPLAY_A, route: '/' }
    )
    const retry = await handleHeartbeat(
      { client, post, now: at('2026-08-01T14:00:05Z') },
      { displayId: DISPLAY_A, route: '/' }
    )

    expect(retry.displayCount).toBe(1)
    expect(posted).toHaveLength(1) // second beat throttled: nothing changed
    expect(posted[0].runId).toBe('cafe-menu-displays-2026-08-01')

    // Even forced past the throttle, the key is unchanged.
    const later = await handleHeartbeat(
      { client, post, now: at('2026-08-01T15:00:00Z') },
      { displayId: DISPLAY_A, route: '/' }
    )
    expect(later.displayCount).toBe(1)
    expect(posted).toHaveLength(2)
    expect(posted[1].runId).toBe(posted[0].runId)
  })

  it('resets the count at the UTC day boundary', async () => {
    const client = new FakeSanity()
    const { posted, post } = poster()

    await handleHeartbeat(
      { client, post, now: at('2026-08-01T23:50:00Z') },
      { displayId: DISPLAY_A, route: '/' }
    )
    await handleHeartbeat(
      { client, post, now: at('2026-08-01T23:55:00Z') },
      { displayId: DISPLAY_B, route: '/projection' }
    )
    const newDay = await handleHeartbeat(
      { client, post, now: at('2026-08-02T00:05:00Z') },
      { displayId: DISPLAY_A, route: '/' }
    )

    expect(newDay.day).toBe('2026-08-02')
    expect(newDay.displayCount).toBe(1)
    const last = posted[posted.length - 1]
    expect(last.runId).toBe('cafe-menu-displays-2026-08-02')
    expect(last.meta?.displayCount).toBe(1)
    // Yesterday's record is untouched and still says 2.
    expect(posted.filter((r) => r.runId === 'cafe-menu-displays-2026-08-01').pop()?.meta
      ?.displayCount).toBe(2)
  })

  it('prunes stale day documents on the first beat of a new day only', async () => {
    const client = new FakeSanity()
    const { post } = poster()
    client.docs.set(livenessDocId('2026-07-01'), {
      _id: livenessDocId('2026-07-01'),
      _type: LIVENESS_DOC_TYPE,
      day: '2026-07-01',
    })

    await handleHeartbeat(
      { client, post, now: at('2026-08-01T14:00:00Z') },
      { displayId: DISPLAY_A, route: '/' }
    )
    expect(client.deletes).toHaveLength(1)
    expect(client.docs.has(livenessDocId('2026-07-01'))).toBe(false)

    await handleHeartbeat(
      { client, post, now: at('2026-08-01T14:20:00Z') },
      { displayId: DISPLAY_B, route: '/' }
    )
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

    const first = await handleHeartbeat(
      { client, post, now: at('2026-08-01T14:00:00Z') },
      { displayId: DISPLAY_A, route: '/' }
    )
    expect(first.emitted).toBe(false)

    // Nothing was marked emitted, so the very next beat tries again — not in
    // 30 minutes' time.
    const second = await handleHeartbeat(
      { client, post, now: at('2026-08-01T14:00:30Z') },
      { displayId: DISPLAY_A, route: '/' }
    )
    expect(attempts).toHaveLength(2)
    expect(attempts[1].runId).toBe(attempts[0].runId)
    expect(second.emitted).toBe(false)
  })

  it('does not throw when the Observatory is unreachable', async () => {
    const client = new FakeSanity()
    const post = vi.fn(async () => {
      throw new Error('ECONNREFUSED')
    })

    const result = await handleHeartbeat(
      { client, post, now: at('2026-08-01T14:00:00Z'), warn: vi.fn() },
      { displayId: DISPLAY_A, route: '/' }
    )

    expect(result).toMatchObject({ day: '2026-08-01', displayCount: 1, emitted: false })
  })

  it('does not throw when the Observatory is unconfigured (recordRun skips)', async () => {
    const client = new FakeSanity()
    const post = vi.fn(async (): Promise<RecordRunOutcome> => 'skipped')

    const result = await handleHeartbeat(
      { client, post, now: at('2026-08-01T14:00:00Z') },
      { displayId: DISPLAY_A, route: '/' }
    )

    expect(result.emitted).toBe(false)
    expect(result.outcome).toBe('skipped')
  })

  it('still reports a heartbeat when pruning fails', async () => {
    const client = new FakeSanity()
    client.delete = async () => {
      throw new Error('sanity down')
    }
    const { post } = poster()

    const result = await handleHeartbeat(
      { client, post, now: at('2026-08-01T14:00:00Z'), warn: vi.fn() },
      { displayId: DISPLAY_A, route: '/' }
    )
    expect(result.displayCount).toBe(1)
  })
})
