import { useEffect, useRef, useState } from 'react'
import {
  parseProjectedMenuDocument,
  type ProjectedMenuDocumentV1,
} from '../lib/projectedMenu'

function configuredProjectedMenuUrl(): string {
  const configured = import.meta.env.VITE_PROJECTED_MENU_URL?.trim()
  if (configured) return configured
  if (import.meta.env.DEV) return 'http://localhost:3000/api/projected-menu'
  throw new Error('VITE_PROJECTED_MENU_URL is required in production')
}

const DEFAULT_PROJECTED_MENU_URL = configuredProjectedMenuUrl()
const DEFAULT_REFRESH_INTERVAL_MS = 20_000
const REQUEST_TIMEOUT_MS = 10_000

export const PROJECTED_MENU_STORAGE_KEY = 'white-rabbit:projected-menu:v1'

interface StoredProjectedMenu {
  document: ProjectedMenuDocumentV1
  etag: string | null
}

export interface ProjectedMenuState {
  document: ProjectedMenuDocumentV1 | null
  isLoading: boolean
  error: string | null
  /** True only while a validated document exists and the latest refresh succeeded. */
  isDisplayLive: () => boolean
}

function getStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    // Browsers can expose localStorage while denying access to it.
    return null
  }
}

function restoreProjectedMenu(): StoredProjectedMenu | null {
  const storage = getStorage()
  if (!storage) return null

  try {
    const stored = JSON.parse(storage.getItem(PROJECTED_MENU_STORAGE_KEY) ?? 'null') as unknown
    if (typeof stored !== 'object' || stored === null || !('document' in stored)) {
      return null
    }

    const etag = 'etag' in stored ? stored.etag : null
    if (etag !== null && typeof etag !== 'string') throw new Error('Invalid stored ETag')

    return {
      document: parseProjectedMenuDocument(stored.document),
      etag,
    }
  } catch {
    // Never allow a corrupt or obsolete cache entry to become display data.
    try {
      storage.removeItem(PROJECTED_MENU_STORAGE_KEY)
    } catch {
      // Storage failures do not prevent the network path from operating.
    }
    return null
  }
}

function persistProjectedMenu(document: ProjectedMenuDocumentV1, etag: string | null) {
  try {
    getStorage()?.setItem(
      PROJECTED_MENU_STORAGE_KEY,
      JSON.stringify({ document, etag } satisfies StoredProjectedMenu),
    )
  } catch {
    // A valid network response should remain usable when persistence is blocked.
  }
}

export function useProjectedMenu(
  url = DEFAULT_PROJECTED_MENU_URL,
  refreshIntervalMs = DEFAULT_REFRESH_INTERVAL_MS,
): ProjectedMenuState {
  const [initialCache] = useState(restoreProjectedMenu)
  const etagRef = useRef(initialCache?.etag ?? null)
  const healthRef = useRef({
    hasDocument: initialCache !== null,
    latestFetchHealthy: true,
  })
  const isDisplayLive = useRef(() => (
    healthRef.current.hasDocument && healthRef.current.latestFetchHealthy
  )).current
  const [state, setState] = useState<Omit<ProjectedMenuState, 'isDisplayLive'>>({
    document: initialCache?.document ?? null,
    isLoading: !initialCache,
    error: null,
  })

  useEffect(() => {
    let disposed = false
    let inFlight = false
    let retryAfterFlight = false
    let pollTimer: number | undefined
    let controller: AbortController | null = null

    const clearPollTimer = () => {
      if (pollTimer !== undefined) window.clearTimeout(pollTimer)
      pollTimer = undefined
    }

    const scheduleNextPoll = () => {
      clearPollTimer()
      if (!disposed && refreshIntervalMs > 0) {
        pollTimer = window.setTimeout(fetchProjectedMenu, refreshIntervalMs)
      }
    }

    const fetchProjectedMenu = async () => {
      if (disposed || inFlight) return

      clearPollTimer()
      inFlight = true
      controller = new AbortController()
      const requestController = controller
      let timedOut = false
      const abortTimer = window.setTimeout(() => {
        timedOut = true
        requestController.abort()
      }, REQUEST_TIMEOUT_MS)

      try {
        const headers: HeadersInit = {}
        if (etagRef.current) headers['If-None-Match'] = etagRef.current

        const response = await fetch(url, {
          cache: 'no-store',
          headers,
          signal: requestController.signal,
        })

        if (response.status === 304) {
          if (disposed) return
          setState((current) => {
            healthRef.current = {
              hasDocument: current.document !== null,
              latestFetchHealthy: current.document !== null,
            }
            return current.document
              ? { ...current, isLoading: false, error: null }
              : {
                document: null,
                isLoading: false,
                error: 'Projected menu was unchanged, but no saved menu is available',
              }
          })
          return
        }

        if (!response.ok) {
          throw new Error(`Projected menu request failed (${response.status})`)
        }

        // Validation completes before either the displayed or persisted document
        // is replaced, so a partial response cannot leak into the menu.
        const document = parseProjectedMenuDocument(await response.json())
        const etag = response.headers?.get('ETag') ?? null
        persistProjectedMenu(document, etag)
        etagRef.current = etag
        if (!disposed) {
          healthRef.current = { hasDocument: true, latestFetchHealthy: true }
          setState({ document, isLoading: false, error: null })
        }
      } catch (error) {
        if (disposed) return
        if (error instanceof DOMException && error.name === 'AbortError' && !timedOut) return

        const message = timedOut
          ? 'Projected menu request timed out'
          : error instanceof Error
            ? error.message
            : 'Failed to load projected menu'
        // Keep the last known-good document visible during transient failures.
        setState((current) => {
          healthRef.current = {
            hasDocument: current.document !== null,
            latestFetchHealthy: false,
          }
          return { ...current, isLoading: false, error: message }
        })
      } finally {
        window.clearTimeout(abortTimer)
        if (controller === requestController) controller = null
        inFlight = false

        if (retryAfterFlight && !disposed) {
          retryAfterFlight = false
          void fetchProjectedMenu()
        } else {
          scheduleNextPoll()
        }
      }
    }

    const retryNow = () => {
      if (disposed) return
      clearPollTimer()
      if (inFlight) {
        retryAfterFlight = true
      } else {
        void fetchProjectedMenu()
      }
    }

    const retryWhenVisible = () => {
      if (document.visibilityState === 'visible') retryNow()
    }

    void fetchProjectedMenu()
    window.addEventListener('online', retryNow)
    document.addEventListener('visibilitychange', retryWhenVisible)

    return () => {
      disposed = true
      clearPollTimer()
      controller?.abort()
      window.removeEventListener('online', retryNow)
      document.removeEventListener('visibilitychange', retryWhenVisible)
    }
  }, [refreshIntervalMs, url])

  return { ...state, isDisplayLive }
}
