import { useEffect, useRef } from 'react'
import {
  HEARTBEAT_INTERVAL_MS,
  getDisplayId,
  postDisplayHeartbeat,
  resolveHeartbeatEndpoint,
} from '../lib/displayHeartbeat'

export interface UseDisplayHeartbeatOptions {
  /**
   * The board's own liveness verdict, read at each tick. Source this from
   * `useMenuData().isDisplayLive` so it agrees with the Sanity staleness
   * watchdog rather than being a second opinion about health.
   */
  isLive: () => boolean
  /** Route this board is rendering; only ambient display routes report in. */
  route: string
  /** False for routes that are not displays (e.g. the print layouts). */
  enabled?: boolean
  intervalMs?: number
}

/**
 * Periodically report that this display is alive and rendering menu content.
 *
 * Deliberately inert with respect to rendering: it holds no state, returns
 * nothing, never re-renders its host, and reads liveness through a ref-backed
 * getter so a heartbeat can never schedule a React update. The post itself
 * cannot reject. If the whole telemetry path is broken, the only observable
 * effect is a missing number on a dashboard.
 *
 * The first beat lands one interval after mount, not on mount — see
 * HEARTBEAT_INTERVAL_MS for why.
 */
export function useDisplayHeartbeat({
  isLive,
  route,
  enabled = true,
  intervalMs = HEARTBEAT_INTERVAL_MS,
}: UseDisplayHeartbeatOptions): void {
  // Latest values without re-arming the interval.
  const isLiveRef = useRef(isLive)
  const routeRef = useRef(route)
  useEffect(() => {
    isLiveRef.current = isLive
    routeRef.current = route
  })

  useEffect(() => {
    if (!enabled) return

    const endpoint = resolveHeartbeatEndpoint()
    if (!endpoint) return

    let displayId: string
    try {
      displayId = getDisplayId()
    } catch {
      return
    }

    const timer = setInterval(() => {
      try {
        if (!isLiveRef.current()) return
        void postDisplayHeartbeat({ endpoint, displayId, route: routeRef.current })
      } catch {
        // A heartbeat is never worth an uncaught error on a kiosk.
      }
    }, intervalMs)

    return () => clearInterval(timer)
  }, [enabled, intervalMs])
}
