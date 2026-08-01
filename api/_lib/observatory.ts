/**
 * Agent Observatory — copy-in run recorder (ingest contract v1).
 *
 * A tiny, self-contained HTTP recorder that posts a single-shot run record to
 * the Agent Observatory ingest API. Copy-in by design: there is NO shared
 * package and no shared database between this repo and the Observatory — only
 * an outbound HTTPS POST with a bearer token.
 *
 *   POST ${OBSERVATORY_URL}/api/runs
 *   Authorization: Bearer ${OBSERVATORY_INGEST_TOKEN}
 *   body: { runId, agent, status, startedAt, finishedAt, exitCode?, summary?,
 *           host?, runtime?, meta? }  → expects 200 { ok: true }
 *
 * The ingest schema is *strict* (unknown keys are rejected, not coerced), so
 * this builds the body field by field rather than spreading the caller's object.
 *
 * Invariants that make this safe to call from a request handler:
 *   - It NEVER throws into the caller. Unset env, DNS failure, timeout, non-200,
 *     bad slug — all are swallowed and logged.
 *   - It is a silent no-op when OBSERVATORY_URL / OBSERVATORY_INGEST_TOKEN are
 *     unset, so an un-provisioned environment cannot break anything.
 *   - A short AbortController timeout means a slow or dead Observatory can never
 *     stall the request beyond {@link DEFAULT_TIMEOUT_MS}.
 */

/** Matches the ingest API's agent-slug rule; a record with a bad slug is dropped. */
const AGENT_SLUG_RE = /^[a-z0-9][a-z0-9-]*$/
/** Cap how long a slow Observatory may hold up the caller. */
export const DEFAULT_TIMEOUT_MS = 3000
/** Keep the journal skinny — summaries are a hint, not a log. */
const MAX_SUMMARY_LENGTH = 500

export type RunStatus = 'ok' | 'failed'

export interface RunRecord {
  runId: string
  agent: string
  status: RunStatus
  startedAt: string
  finishedAt: string
  exitCode?: number
  summary?: string
  host?: string
  runtime?: string
  meta?: Record<string, unknown>
}

/**
 * What happened to the post. Callers use this to decide follow-up bookkeeping
 * (e.g. only advancing an "already emitted" marker on `posted`) — never to
 * decide whether to fail.
 */
export type RecordRunOutcome = 'posted' | 'skipped' | 'failed'

export interface RecordRunOptions {
  timeoutMs?: number
  /** Injectable for tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch
  /** Injectable for tests; defaults to process.env. */
  env?: Record<string, string | undefined>
  /** Injectable for tests; defaults to console.warn. */
  warn?: (message: string, detail?: unknown) => void
}

/**
 * Post a single completed run record to the Observatory. Resolves (never
 * rejects) once the post has been attempted. Silent no-op when the Observatory
 * env vars are unset.
 */
export async function recordRun(
  record: RunRecord,
  options: RecordRunOptions = {}
): Promise<RecordRunOutcome> {
  const env = options.env ?? process.env
  const warn = options.warn ?? ((message: string, detail?: unknown) => console.warn(message, detail))
  const doFetch = options.fetchImpl ?? fetch

  const baseUrl = env.OBSERVATORY_URL
  const token = env.OBSERVATORY_INGEST_TOKEN
  if (!baseUrl || !token) return 'skipped'

  if (!AGENT_SLUG_RE.test(record.agent)) {
    warn('Observatory recorder: invalid agent slug, skipping', { agent: record.agent })
    return 'skipped'
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS)

  try {
    const res = await doFetch(`${baseUrl.replace(/\/$/, '')}/api/runs`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        runId: record.runId,
        agent: record.agent,
        status: record.status,
        startedAt: record.startedAt,
        finishedAt: record.finishedAt,
        ...(record.exitCode !== undefined ? { exitCode: record.exitCode } : {}),
        ...(record.summary !== undefined ? { summary: bound(record.summary) } : {}),
        host: record.host ?? 'vercel',
        runtime: record.runtime ?? 'vercel-function',
        ...(record.meta ? { meta: record.meta } : {}),
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      warn('Observatory recorder: non-200 response', { agent: record.agent, status: res.status })
      return 'failed'
    }

    const body = (await res.json().catch(() => null)) as { ok?: boolean } | null
    if (!body || body.ok !== true) {
      warn('Observatory recorder: unexpected response body', { agent: record.agent })
      return 'failed'
    }

    return 'posted'
  } catch (error) {
    warn('Observatory recorder: post failed', {
      agent: record.agent,
      error: error instanceof Error ? error.message : String(error),
    })
    return 'failed'
  } finally {
    clearTimeout(timeout)
  }
}

/** True when the Observatory is provisioned in this environment. */
export function isObservatoryConfigured(
  env: Record<string, string | undefined> = process.env
): boolean {
  return Boolean(env.OBSERVATORY_URL && env.OBSERVATORY_INGEST_TOKEN)
}

function bound(text: string): string {
  return text.length > MAX_SUMMARY_LENGTH ? `${text.slice(0, MAX_SUMMARY_LENGTH - 1)}…` : text
}
