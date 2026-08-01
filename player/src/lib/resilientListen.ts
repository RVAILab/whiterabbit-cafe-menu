import { client } from './sanity'

/**
 * Self-healing wrapper around Sanity's `client.listen()`.
 *
 * The raw Sanity listener opens an EventSource and exposes an observable. When
 * that connection dies in a way the browser can't transparently recover from
 * (terminal channel error, auth hiccup, long-lived connection reaped by a proxy
 * after many hours of kiosk uptime), the observable *errors* and the
 * subscription is gone for good. A plain `error: () => console.error(...)`
 * handler therefore means the page silently stops receiving updates until it's
 * manually reloaded — which is exactly how the projector display "stops
 * responding to display controls" after running for a while.
 *
 * This helper keeps the listener alive by:
 *  - re-subscribing on `error`/`complete` with exponential backoff (capped),
 *  - reconnecting immediately when the tab becomes visible again,
 *  - reconnecting immediately when the network comes back online, and
 *  - a staleness watchdog that forces a reconnect when no event has arrived
 *    for a while, covering the "half-open" case where the EventSource is
 *    silently dead (proxy reaped it, server stopped pushing) yet never emits
 *    `error`/`complete`, so `connected` would otherwise stay `true` forever.
 *
 * Returns a cleanup function that permanently stops the listener.
 */
// Loose shape of a Sanity listener event — covers the fields the consumers
// read (type/result/documentId/mutations) without pinning the full union.
export interface SanityListenEvent {
  type?: string
  result?: unknown
  documentId?: string
  mutations?: unknown
  [key: string]: unknown
}

export interface ResilientListenOptions {
  query: string
  params?: Record<string, unknown>
  // Passed straight through to client.listen() (e.g. { includeResult: true }).
  listenOptions?: Record<string, unknown>
  // Called for every event from the underlying listener (welcome, mutation, …).
  onEvent: (event: SanityListenEvent) => void
  // Label used in console diagnostics so multiple listeners are distinguishable.
  label?: string
  // Called (on change only) with the watchdog's own verdict on this listener:
  // `true` while the channel is confirmed open and has produced an event inside
  // the staleness window, `false` once it is disconnected, backing off, or
  // stale. This is deliberately the *same* condition the watchdog acts on — a
  // consumer that reports liveness elsewhere must agree with what this file
  // already treats as a healthy, currently-rendering display rather than
  // inventing a second definition. A subscriber that throws is isolated: it
  // cannot break the listener it is observing.
  onHealthChange?: (healthy: boolean) => void
}

// `client.listen()` filters the stream to `['mutation']` unless told otherwise
// (see ListenOptions.events), so without this the watchdog never sees the
// `welcome` it uses to decide a channel is established and `connected` stays
// false for the life of the page. Both consumers already branch on
// welcome/reconnect events; this makes them actually arrive. A caller can still
// override `events` through `listenOptions`.
const DEFAULT_LISTEN_EVENTS = ['welcome', 'mutation', 'reconnect'] as const

const MAX_BACKOFF_MS = 30_000
// Sanity's listen stream emits periodic keep-alive events, so a healthy
// connection is never silent for long. If we go this long with no event of any
// kind, assume the connection is half-open and force a fresh one.
const STALE_TIMEOUT_MS = 75_000
// How often the watchdog checks for staleness.
const WATCHDOG_INTERVAL_MS = 30_000

export function resilientListen({
  query,
  params = {},
  listenOptions = {},
  onEvent,
  label = 'listener',
  onHealthChange,
}: ResilientListenOptions): () => void {
  let subscription: { unsubscribe: () => void } | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let watchdogTimer: ReturnType<typeof setInterval> | null = null
  let lastEventAt = 0
  let attempt = 0
  let connected = false
  let stopped = false
  let lastPublishedHealth: boolean | null = null

  // The single definition of "this listener is healthy": the channel is
  // confirmed open *and* the watchdog's staleness window has not elapsed.
  // `checkStaleness` acts on exactly this condition.
  const isHealthy = () => !stopped && connected && Date.now() - lastEventAt <= STALE_TIMEOUT_MS

  const publishHealth = () => {
    if (!onHealthChange) return
    const healthy = isHealthy()
    if (healthy === lastPublishedHealth) return
    lastPublishedHealth = healthy
    try {
      onHealthChange(healthy)
    } catch (err) {
      // An observer must never be able to take down the listener it observes.
      console.error(`📡 ${label}: health subscriber threw`, err)
    }
  }

  const clearReconnectTimer = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
  }

  const scheduleReconnect = () => {
    if (stopped || reconnectTimer) return
    const delay = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** attempt)
    attempt += 1
    console.warn(`📡 ${label}: reconnecting in ${delay}ms (attempt ${attempt})`)
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      connect()
    }, delay)
  }

  const connect = () => {
    if (stopped) return
    clearReconnectTimer()
    // Tear down any prior subscription before opening a new one.
    if (subscription) {
      subscription.unsubscribe()
      subscription = null
    }

    // Reset the staleness clock so a brand-new connection that never delivers
    // a welcome is still retried by the watchdog rather than waiting forever.
    lastEventAt = Date.now()

    const resolvedOptions = { events: [...DEFAULT_LISTEN_EVENTS], ...listenOptions }

    subscription = client.listen(query, params, resolvedOptions).subscribe({
      next: (event: SanityListenEvent) => {
        // Any event (welcome, mutation, keep-alive, …) proves the stream is live.
        lastEventAt = Date.now()
        // A welcome event means the channel is (re)established and healthy.
        if (event?.type === 'welcome') {
          connected = true
          attempt = 0
        } else if (event?.type === 'reconnect') {
          // Transport-level reconnect in progress — no longer confirmed live.
          connected = false
        } else if (event?.type === 'mutation') {
          attempt = 0
        }
        publishHealth()
        onEvent(event)
      },
      error: (err: unknown) => {
        connected = false
        publishHealth()
        console.error(`📡 ${label} error:`, err)
        scheduleReconnect()
      },
      complete: () => {
        // The listener completed unexpectedly; treat it as a disconnect.
        connected = false
        publishHealth()
        scheduleReconnect()
      },
    })
  }

  const reconnectIfDropped = () => {
    if (stopped || connected) return
    attempt = 0
    connect()
  }

  // Force a reconnect even when we believe we're `connected` — used by the
  // watchdog to recover a half-open stream that stopped delivering silently.
  const forceReconnect = () => {
    if (stopped) return
    console.warn(`📡 ${label}: stream stale, forcing reconnect`)
    connected = false
    publishHealth()
    attempt = 0
    connect()
  }

  const checkStaleness = () => {
    if (stopped) return
    if (!reconnectTimer && Date.now() - lastEventAt > STALE_TIMEOUT_MS) forceReconnect()
    // Publish on every tick as well as on transitions: a stream that goes
    // silent without erroring only becomes unhealthy on the clock.
    publishHealth()
  }

  const handleVisibility = () => {
    if (document.visibilityState === 'visible') reconnectIfDropped()
  }

  connect()
  watchdogTimer = setInterval(checkStaleness, WATCHDOG_INTERVAL_MS)

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibility)
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('online', reconnectIfDropped)
  }

  return () => {
    stopped = true
    publishHealth()
    clearReconnectTimer()
    if (watchdogTimer) {
      clearInterval(watchdogTimer)
      watchdogTimer = null
    }
    if (subscription) {
      subscription.unsubscribe()
      subscription = null
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibility)
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', reconnectIfDropped)
    }
  }
}
