/**
 * Display liveness — the café menu boards' honest usage signal.
 *
 * The menu boards are ambient displays: nobody clicks them, so product
 * analytics would report zero forever. What can be measured is *liveness* —
 * did a display fetch and keep rendering menu content today. Each board posts
 * a periodic heartbeat to `POST /api/display` (see `api/display.ts`), and this
 * module rolls those heartbeats up into **one** Agent Observatory run record
 * per UTC day, carrying the distinct display count in `meta`.
 *
 * Design notes
 * ------------
 * **One record per day, by construction.** The `runId` is derived from the UTC
 * day (`cafe-menu-displays-YYYY-MM-DD`). The Observatory upserts on `runId`, so
 * every emit during a day refreshes the same record rather than appending a new
 * one — the idempotency key doubles as the aggregation key. A retried or
 * duplicated emit is therefore free, and the day boundary resets the count
 * cleanly: a new day means a new doc id and a new runId, so the count starts
 * from zero with no cross-day bleed.
 *
 * **Why UTC.** The Observatory's daily series is keyed on the UTC calendar day.
 * Keying the runId the same way keeps each run record wholly inside the day it
 * is attributed to — `startedAt` and `finishedAt` are both the same UTC day —
 * so it buckets identically no matter which timestamp the collector reads.
 *
 * **Where the state lives.** Sanity, the only datastore this app has. A
 * `displayLiveness` document per day; the type is not in the listener query the
 * players subscribe to, so writing it can never trigger a re-render or a
 * re-fetch on the boards. Documents are pruned after {@link RETENTION_DAYS}.
 *
 * **Nothing here may affect the display.** Every function is called from the
 * heartbeat branch of the display API, which is completely disjoint from the
 * path that renders the menu; the caller swallows every error.
 */

import { recordRun, type RecordRunOutcome, type RunRecord } from './observatory'

/** Observatory agent slug this app emits under. */
export const AGENT_SLUG = 'cafe-menu-displays'
/** Sanity document type holding a single UTC day's display roll-up. */
export const LIVENESS_DOC_TYPE = 'displayLiveness'
/** The action name the players post to `/api/display`. */
export const HEARTBEAT_ACTION = 'heartbeat'
/**
 * A display id is an opaque client-generated UUID persisted in the board's
 * localStorage. Validated strictly: it is interpolated into a Sanity array
 * selector, and it bounds what an unauthenticated caller can write.
 */
export const DISPLAY_ID_RE = /^[a-z0-9][a-z0-9-]{7,63}$/
/** Routes that are actually ambient displays. `/print*` is a paper artifact. */
export const DISPLAY_ROUTES = ['/', '/projection'] as const
/**
 * Hard cap on distinct displays counted in a day. The heartbeat is
 * unauthenticated (a browser cannot hold the display API key), so this bounds
 * both the document size and how far a stray caller could inflate the number.
 */
export const MAX_DISPLAYS_PER_DAY = 24
/** Don't re-post to the Observatory more often than this unless the count moved. */
export const EMIT_MIN_INTERVAL_MS = 30 * 60 * 1000
/** How long day documents are kept before being pruned. */
export const RETENTION_DAYS = 14

export interface DisplayEntry {
  _key: string
  route: string
  lastSeenAt: string
}

export interface LivenessDoc {
  _id: string
  _type: string
  day: string
  startedAt: string
  lastSeenAt: string
  displays?: DisplayEntry[]
  emittedAt?: string
  emittedCount?: number
}

/** The slice of the Sanity client this module uses, so tests can fake it. */
export interface LivenessPatch {
  setIfMissing(attrs: Record<string, unknown>): LivenessPatch
  set(attrs: Record<string, unknown>): LivenessPatch
  unset(paths: string[]): LivenessPatch
  insert(position: 'after', path: string, items: unknown[]): LivenessPatch
  commit(): Promise<unknown>
}

export interface LivenessClient {
  getDocument(id: string): Promise<unknown>
  createIfNotExists(doc: Record<string, unknown>): Promise<unknown>
  patch(id: string): LivenessPatch
  delete(selection: { query: string; params?: Record<string, unknown> }): Promise<unknown>
}

/** UTC calendar day, `YYYY-MM-DD`. */
export function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10)
}

/** Sanity document id for a day's roll-up. */
export function livenessDocId(day: string): string {
  return `${LIVENESS_DOC_TYPE}.${day}`
}

/**
 * Client-supplied idempotency key. One per UTC day, so every emit that day
 * upserts the same run record and a retry can never duplicate it.
 */
export function runIdForDay(day: string): string {
  return `${AGENT_SLUG}-${day}`
}

/** UTC day `RETENTION_DAYS` before `now` — everything older is pruned. */
export function retentionCutoffDay(now: Date, retentionDays = RETENTION_DAYS): string {
  return utcDay(new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000))
}

export function isDisplayRoute(route: string): boolean {
  return (DISPLAY_ROUTES as readonly string[]).includes(route)
}

export interface HeartbeatInput {
  displayId: string
  route: string
}

/**
 * Validate a heartbeat body. Strict rather than forgiving, mirroring the
 * Observatory's own "reject, never coerce" stance: the only legitimate caller
 * is this app's own player.
 *
 * Returns a nullable pair rather than a discriminated union so the narrowing
 * holds under Vercel's function tsconfig as well as this repo's.
 */
export interface ParsedHeartbeat {
  value: HeartbeatInput | null
  error: string | null
}

export function parseHeartbeat(body: unknown): ParsedHeartbeat {
  const { value, route } = (body ?? {}) as { value?: unknown; route?: unknown }

  if (typeof value !== 'string' || !DISPLAY_ID_RE.test(value)) {
    return { value: null, error: 'Heartbeat requires a value: an opaque display id' }
  }
  if (typeof route !== 'string' || !isDisplayRoute(route)) {
    return {
      value: null,
      error: `Heartbeat requires a route: one of ${DISPLAY_ROUTES.join(', ')}`,
    }
  }

  return { value: { displayId: value, route }, error: null }
}

/**
 * Record one display's heartbeat into the day's roll-up and return the updated
 * document.
 *
 * The upsert of the display entry is a single server-side patch
 * (`unset` the existing key, then append), so two boards heartbeating at the
 * same moment cannot clobber each other the way a read-modify-write would.
 */
export async function trackHeartbeat(
  client: LivenessClient,
  input: HeartbeatInput,
  now: Date
): Promise<{ doc: LivenessDoc; isNewDay: boolean; capped: boolean }> {
  if (!DISPLAY_ID_RE.test(input.displayId)) {
    // Belt and braces: the id is interpolated into a Sanity selector below.
    throw new Error('invalid display id')
  }

  const day = utcDay(now)
  const _id = livenessDocId(day)
  const nowIso = now.toISOString()

  const existing = (await client.getDocument(_id)) as LivenessDoc | undefined | null
  const known = existing?.displays ?? []
  const isNewDay = !existing
  const isKnownDisplay = known.some((entry) => entry?._key === input.displayId)
  const capped = !isKnownDisplay && known.length >= MAX_DISPLAYS_PER_DAY

  await client.createIfNotExists({
    _id,
    _type: LIVENESS_DOC_TYPE,
    day,
    startedAt: nowIso,
    lastSeenAt: nowIso,
    displays: [],
  })

  let patch = client
    .patch(_id)
    .setIfMissing({ day, startedAt: nowIso, displays: [] })
    .set({ lastSeenAt: nowIso })

  if (!capped) {
    patch = patch
      .unset([`displays[_key=="${input.displayId}"]`])
      .insert('after', 'displays[-1]', [
        { _key: input.displayId, route: input.route, lastSeenAt: nowIso },
      ])
  }

  const doc = (await patch.commit()) as LivenessDoc

  return { doc, isNewDay, capped }
}

/**
 * Should this heartbeat trigger an Observatory post?
 *
 * Emit when the distinct count moved (a display appeared, so the number the
 * grid shows is now wrong) or when the last emit has gone stale. Otherwise the
 * day's record is already accurate and another post would be noise.
 */
export function shouldEmit(
  doc: Pick<LivenessDoc, 'displays' | 'emittedAt' | 'emittedCount'>,
  now: Date,
  minIntervalMs = EMIT_MIN_INTERVAL_MS
): boolean {
  const displayCount = doc.displays?.length ?? 0
  if (displayCount === 0) return false
  if (doc.emittedCount !== displayCount) return true
  if (!doc.emittedAt) return true

  const emittedAt = Date.parse(doc.emittedAt)
  if (Number.isNaN(emittedAt)) return true

  return now.getTime() - emittedAt >= minIntervalMs
}

/** Build the single-shot run record for a day's roll-up. */
export function buildRunRecord(doc: LivenessDoc, capped = false): RunRecord {
  const displays = doc.displays ?? []
  const count = displays.length

  return {
    runId: runIdForDay(doc.day),
    agent: AGENT_SLUG,
    status: 'ok',
    // Both timestamps sit inside the run's own UTC day, so the record buckets
    // to `doc.day` whichever end the collector reads.
    startedAt: doc.startedAt,
    finishedAt: doc.lastSeenAt,
    exitCode: 0,
    summary: `${count} display${count === 1 ? '' : 's'} reporting on ${doc.day}`,
    host: 'vercel',
    runtime: 'cafe-menu-display-heartbeat',
    meta: {
      app: 'whiterabbit-cafe-menu',
      day: doc.day,
      displayCount: count,
      displays: displays.map((entry) => ({
        id: entry._key,
        route: entry.route,
        lastSeenAt: entry.lastSeenAt,
      })),
      ...(capped ? { capped: true } : {}),
    },
  }
}

export interface HandleHeartbeatDeps {
  client: LivenessClient
  now?: Date
  /** Injectable for tests; defaults to the real Observatory recorder. */
  post?: (record: RunRecord) => Promise<RecordRunOutcome>
  warn?: (message: string, detail?: unknown) => void
}

export interface HeartbeatResult {
  day: string
  displayCount: number
  emitted: boolean
  outcome?: RecordRunOutcome
}

/**
 * Track a heartbeat, then emit the day's roll-up if it is due.
 *
 * Errors from the Observatory post are swallowed by {@link recordRun} itself;
 * a failed post simply leaves `emittedAt` untouched so the next heartbeat
 * retries with the same (idempotent) runId. Errors from Sanity propagate to the
 * caller, which swallows them — see `api/display.ts`.
 */
export async function handleHeartbeat(
  deps: HandleHeartbeatDeps,
  input: HeartbeatInput
): Promise<HeartbeatResult> {
  const now = deps.now ?? new Date()
  const post = deps.post ?? ((record: RunRecord) => recordRun(record))
  const warn = deps.warn ?? ((message: string, detail?: unknown) => console.warn(message, detail))

  const { doc, isNewDay, capped } = await trackHeartbeat(deps.client, input, now)
  const day = doc.day ?? utcDay(now)
  const displayCount = doc.displays?.length ?? 0

  if (isNewDay) {
    // First heartbeat of a new UTC day — a good moment to prune old roll-ups.
    // Best-effort: a failed prune must not affect the heartbeat.
    try {
      await deps.client.delete({
        query: `*[_type == "${LIVENESS_DOC_TYPE}" && day < $cutoff]`,
        params: { cutoff: retentionCutoffDay(now) },
      })
    } catch (error) {
      warn('Display heartbeat: pruning old liveness docs failed', {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  if (!shouldEmit(doc, now)) {
    return { day, displayCount, emitted: false }
  }

  // `recordRun` already swallows everything; the try is for an injected poster
  // that does not honour that contract. Telemetry never escalates.
  let outcome: RecordRunOutcome = 'failed'
  try {
    outcome = await post(buildRunRecord(doc, capped))
  } catch (error) {
    warn('Display heartbeat: Observatory post threw', {
      error: error instanceof Error ? error.message : String(error),
    })
  }

  if (outcome === 'posted') {
    // Only advance the marker on a confirmed post, so a failure retries.
    try {
      await deps.client
        .patch(livenessDocId(day))
        .set({ emittedAt: now.toISOString(), emittedCount: displayCount })
        .commit()
    } catch (error) {
      warn('Display heartbeat: recording emit marker failed', {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return { day, displayCount, emitted: outcome === 'posted', outcome }
}
