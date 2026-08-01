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
 * **A display is something that stays up, not something that loads the page.**
 * The menu URL is public, so a heartbeat alone proves only that a browser had
 * the page open. A tracked id counts only after sustained presence during the
 * day — {@link MIN_PRESENCE_BEATS} beats spanning {@link MIN_PRESENCE_MS} — which
 * a board clears on any day it runs and a passer-by essentially never does.
 * Everything else is tracked but reported as `pending`, so a lingering tab can
 * never make the grid claim a board is up when it is dark.
 *
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
 * Hard cap on distinct display ids *tracked* in a day. Bounds the document
 * size; it is not the count. When the cap is reached, an arriving display
 * evicts the least-present entry that has not yet qualified (see
 * {@link isSustainedDisplay}) rather than being turned away, so a run of
 * passing browsers can never crowd out a real board.
 */
export const MAX_DISPLAYS_PER_DAY = 64
/**
 * How long a display id must have been present during the day before it counts.
 *
 * The number answers "are the menu boards up", so it must not be satisfiable by
 * anything other than a board. The menu URL is public: a phone or laptop left on
 * it would otherwise count, and report boards alive when they could be dark.
 *
 * A real board runs a whole session continuously; a passer-by does not. Two
 * hours is far above any casual visit and far below any operating session — a
 * board clears it on any day it runs, including a short one, because a UTC day's
 * window (17:00 local to 17:00 local) contains a full local session.
 */
export const MIN_PRESENCE_MS = 2 * 60 * 60 * 1000
/**
 * The player's heartbeat interval. Mirrors HEARTBEAT_INTERVAL_MS in
 * player/src/lib/displayHeartbeat.ts — used only to derive how many beats two
 * hours of continuous presence implies.
 */
export const EXPECTED_HEARTBEAT_INTERVAL_MS = 10 * 60 * 1000
/**
 * Beats a display must have sent as well as spanning {@link MIN_PRESENCE_MS}.
 *
 * Span alone would accept a browser opened twice hours apart — two beats, a wide
 * span, not a board. Beats alone would accept a client that ignored the interval
 * and posted in a burst. Together they mean what they say: present, continuously,
 * for hours.
 */
export const MIN_PRESENCE_BEATS = Math.ceil(MIN_PRESENCE_MS / EXPECTED_HEARTBEAT_INTERVAL_MS)
/** Don't re-post to the Observatory more often than this unless the count moved. */
export const EMIT_MIN_INTERVAL_MS = 30 * 60 * 1000
/** How long day documents are kept before being pruned. */
export const RETENTION_DAYS = 14

export interface DisplayEntry {
  _key: string
  route: string
  firstSeenAt: string
  lastSeenAt: string
  beats: number
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

/**
 * Has this display id shown sustained presence — enough beats, spanning enough
 * of the day — to be a board rather than a browser that happened to be open?
 *
 * Span is measured first beat → last beat, never to "now": a board that ran all
 * morning and was switched off at noon was present for the morning.
 */
export function isSustainedDisplay(entry: DisplayEntry | undefined | null): boolean {
  if (!entry) return false
  if ((entry.beats ?? 0) < MIN_PRESENCE_BEATS) return false

  const first = Date.parse(entry.firstSeenAt ?? '')
  const last = Date.parse(entry.lastSeenAt ?? '')
  if (Number.isNaN(first) || Number.isNaN(last)) return false

  return last - first >= MIN_PRESENCE_MS
}

/** The tracked ids that have qualified as displays. */
export function sustainedDisplays(displays: DisplayEntry[] | undefined): DisplayEntry[] {
  return (displays ?? []).filter(isSustainedDisplay)
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
 * The entry to drop when a new display arrives at a full document: the
 * least-present id that has not yet qualified. A qualified display is never
 * evicted, so passing browsers cannot crowd out a board. Returns null when
 * every tracked id has qualified — 64 real boards is not a thing that happens.
 */
export function evictionCandidate(displays: DisplayEntry[]): DisplayEntry | null {
  const unqualified = displays.filter((entry) => !isSustainedDisplay(entry))
  if (unqualified.length === 0) return null

  return unqualified.reduce((weakest, entry) => {
    const beats = entry.beats ?? 0
    const weakestBeats = weakest.beats ?? 0
    if (beats !== weakestBeats) return beats < weakestBeats ? entry : weakest
    return (entry.lastSeenAt ?? '') < (weakest.lastSeenAt ?? '') ? entry : weakest
  })
}

/**
 * Record one display's heartbeat into the day's roll-up and return the updated
 * document.
 *
 * The entry upsert is a single server-side patch (`unset` the existing key, then
 * append), so two *different* boards heartbeating at the same moment cannot
 * clobber each other the way a read-modify-write would. `firstSeenAt` and
 * `beats` do carry over from the read, which is only racy against two concurrent
 * beats from the *same* id — one browser on a ten-minute timer — and the worst
 * case is a delayed qualification, never an inflated one.
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
  const previous = known.find((entry) => entry?._key === input.displayId)

  // Full document and an unknown display: make room by dropping the weakest
  // entry that has not qualified, rather than refusing to track a possible board.
  const evicted = !previous && known.length >= MAX_DISPLAYS_PER_DAY
    ? evictionCandidate(known)
    : null
  const capped = !previous && known.length >= MAX_DISPLAYS_PER_DAY && !evicted

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
    const stale = [`displays[_key=="${input.displayId}"]`]
    if (evicted) stale.push(`displays[_key=="${evicted._key}"]`)

    patch = patch.unset(stale).insert('after', 'displays[-1]', [
      {
        _key: input.displayId,
        route: input.route,
        firstSeenAt: previous?.firstSeenAt ?? nowIso,
        lastSeenAt: nowIso,
        beats: (previous?.beats ?? 0) + 1,
      },
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
  // Only qualified displays count, so a day with nothing but passing browsers
  // never posts a record at all rather than posting a misleading one.
  const displayCount = sustainedDisplays(doc.displays).length
  if (displayCount === 0) return false
  if (doc.emittedCount !== displayCount) return true
  if (!doc.emittedAt) return true

  const emittedAt = Date.parse(doc.emittedAt)
  if (Number.isNaN(emittedAt)) return true

  return now.getTime() - emittedAt >= minIntervalMs
}

/**
 * Build the single-shot run record for a day's roll-up.
 *
 * Only displays that showed sustained presence are counted or listed; the rest
 * are reported as a `pending` tally so a low count is explainable without
 * changing what `displayCount` means.
 */
export function buildRunRecord(doc: LivenessDoc, capped = false): RunRecord {
  const tracked = doc.displays ?? []
  const displays = sustainedDisplays(tracked)
  const count = displays.length

  // Start from the first qualified display's arrival where there is one, so the
  // record describes the boards rather than whatever else touched the URL first.
  // Every entry timestamp is inside the day, so the record still buckets to it.
  const startedAt = displays.reduce(
    (earliest, entry) => (entry.firstSeenAt < earliest ? entry.firstSeenAt : earliest),
    displays[0]?.firstSeenAt ?? doc.startedAt
  )

  return {
    runId: runIdForDay(doc.day),
    agent: AGENT_SLUG,
    status: 'ok',
    // Both timestamps sit inside the run's own UTC day, so the record buckets
    // to `doc.day` whichever end the collector reads.
    startedAt,
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
        firstSeenAt: entry.firstSeenAt,
        lastSeenAt: entry.lastSeenAt,
        beats: entry.beats,
      })),
      // Tracked ids that have not shown sustained presence — passing browsers,
      // or a board that has not been up long enough yet.
      pending: tracked.length - count,
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
  /** Displays that have shown sustained presence — the number that is reported. */
  displayCount: number
  /** Tracked ids not yet qualified as displays. */
  pending: number
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
  const tracked = doc.displays ?? []
  const displayCount = sustainedDisplays(tracked).length
  const pending = tracked.length - displayCount

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
    return { day, displayCount, pending, emitted: false }
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

  return { day, displayCount, pending, emitted: outcome === 'posted', outcome }
}
