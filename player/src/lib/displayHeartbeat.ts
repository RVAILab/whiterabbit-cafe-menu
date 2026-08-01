/**
 * Display liveness heartbeat — client half (issue #6).
 *
 * A menu board is an ambient display: nobody interacts with it, so the only
 * honest usage signal is whether it is alive and rendering menu content. Each
 * board posts a periodic heartbeat carrying an opaque, stable display id; the
 * server (`api/display.ts` → `api/_lib/displayLiveness.ts`) rolls the distinct
 * ids up into one Agent Observatory run record per day.
 *
 * **This code must never affect what is on the display.** Everything here is
 * fire-and-forget: no return value is used to drive rendering, no error is
 * rethrown, every call path is wrapped, and the request is bounded by an
 * AbortController so a hung Observatory or a dead network cannot leave anything
 * pending. A menu board going dark because its telemetry failed would be
 * strictly worse than having no telemetry.
 */

/** localStorage key holding this board's stable display id. */
export const DISPLAY_ID_STORAGE_KEY = 'wr-cafe-menu-display-id'

/**
 * How often a live board reports in. The first heartbeat fires one full
 * interval after load, never on mount — a display is something that sits
 * rendering the menu, so a passer-by opening the public menu URL for a minute
 * is never counted as one.
 */
export const HEARTBEAT_INTERVAL_MS = 10 * 60 * 1000

/** A hung endpoint may not hold a request open longer than this. */
export const POST_TIMEOUT_MS = 5000

/** Must match DISPLAY_ID_RE in api/_lib/displayLiveness.ts. */
const DISPLAY_ID_RE = /^[a-z0-9][a-z0-9-]{7,63}$/

/** Fallback id when localStorage is unavailable (private mode, blocked storage). */
let memoryDisplayId: string | null = null

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

function browserStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    // Accessing localStorage itself can throw when storage is blocked.
    return null
  }
}

function newId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
  } catch {
    // fall through to the arithmetic fallback
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * This board's stable display id, generated once and persisted so the same
 * physical screen counts as one display across reloads and across days.
 * Never throws: a board that cannot persist an id still reports, it just
 * appears as a new display after each reload.
 */
export function getDisplayId(storage: StorageLike | null = browserStorage()): string {
  try {
    const stored = storage?.getItem(DISPLAY_ID_STORAGE_KEY)
    if (stored && DISPLAY_ID_RE.test(stored)) return stored

    const id = memoryDisplayId && DISPLAY_ID_RE.test(memoryDisplayId) ? memoryDisplayId : newId()
    memoryDisplayId = id
    storage?.setItem(DISPLAY_ID_STORAGE_KEY, id)
    return id
  } catch {
    // Storage threw (quota, blocked). Keep the id for this page's lifetime.
    if (!memoryDisplayId || !DISPLAY_ID_RE.test(memoryDisplayId)) memoryDisplayId = newId()
    return memoryDisplayId
  }
}

/** Reset the in-memory fallback id. Test seam. */
export function resetDisplayIdCache(): void {
  memoryDisplayId = null
}

/**
 * Where to post. Same-origin by default — the boards are served from the same
 * Vercel project as `/api/display`. Set `VITE_DISPLAY_HEARTBEAT_ENDPOINT=off`
 * to disable the heartbeat entirely for an environment.
 */
export function resolveHeartbeatEndpoint(
  env: Record<string, string | undefined> = import.meta.env as unknown as Record<
    string,
    string | undefined
  >
): string | null {
  const configured = env.VITE_DISPLAY_HEARTBEAT_ENDPOINT
  if (configured === undefined || configured === '') return '/api/display'
  if (configured === 'off') return null
  return configured
}

export interface PostHeartbeatOptions {
  endpoint: string
  displayId: string
  route: string
  timeoutMs?: number
  fetchImpl?: typeof fetch
}

/**
 * Post one heartbeat. Resolves `true` only when the server acknowledged it;
 * resolves `false` for every failure. **Never rejects** — a missing endpoint,
 * an unreachable server, a timeout and a 500 are all the same non-event as far
 * as the display is concerned.
 */
export async function postDisplayHeartbeat({
  endpoint,
  displayId,
  route,
  timeoutMs = POST_TIMEOUT_MS,
  fetchImpl,
}: PostHeartbeatOptions): Promise<boolean> {
  const doFetch = fetchImpl ?? (typeof fetch === 'function' ? fetch : null)
  if (!doFetch) return false

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await doFetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'heartbeat', value: displayId, route }),
      signal: controller.signal,
      // Telemetry is never worth a cache entry or a credential.
      cache: 'no-store',
    })
    return res.ok
  } catch {
    // Swallowed on purpose. Logged at debug volume only — a board with no
    // network already has louder problems on screen.
    return false
  } finally {
    clearTimeout(timer)
  }
}
