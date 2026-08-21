import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useScreenContext } from '../context/ScreenContext'
import { useSleepMode } from '../context/SleepModeContext'
import { useVisualization } from '../context/VisualizationContext'
import {
  parseDisplayControlSnapshot,
  type DisplayControlSnapshotV1,
} from '../lib/displayControl'

function configuredDisplayControlUrl(): string {
  const configured = import.meta.env.VITE_DISPLAY_CONTROL_URL?.trim()
  if (configured) return configured
  if (import.meta.env.DEV) return 'http://localhost:3000/api/display-control'
  throw new Error('VITE_DISPLAY_CONTROL_URL is required in production')
}

const DEFAULT_DISPLAY_CONTROL_URL = configuredDisplayControlUrl()
const DEFAULT_POLL_INTERVAL_MS = 2_000
const REQUEST_TIMEOUT_MS = 5_000

export const DISPLAY_SCREEN_COMMAND_STORAGE_KEY = 'white-rabbit:display-screen-command:v1'
export const DISPLAY_CONTROL_STORAGE_KEY = 'white-rabbit:display-control:v1'

interface StoredDisplayControl {
  snapshot: DisplayControlSnapshotV1
  etag: string | null
}

function getStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

function restoreDisplayControl(): StoredDisplayControl | null {
  const storage = getStorage()
  if (!storage) return null

  try {
    const value = JSON.parse(storage.getItem(DISPLAY_CONTROL_STORAGE_KEY) ?? 'null') as unknown
    if (
      typeof value !== 'object'
      || value === null
      || !('snapshot' in value)
      || !('etag' in value)
      || (value.etag !== null && typeof value.etag !== 'string')
    ) {
      throw new Error('Invalid stored display control')
    }

    return {
      snapshot: parseDisplayControlSnapshot(value.snapshot),
      etag: value.etag,
    }
  } catch {
    try {
      storage.removeItem(DISPLAY_CONTROL_STORAGE_KEY)
    } catch {
      // Storage failures do not prevent the network path from operating.
    }
    return null
  }
}

function persistDisplayControl(snapshot: DisplayControlSnapshotV1, etag: string | null) {
  try {
    getStorage()?.setItem(
      DISPLAY_CONTROL_STORAGE_KEY,
      JSON.stringify({ snapshot, etag } satisfies StoredDisplayControl),
    )
  } catch {
    // A valid control response remains usable when persistence is blocked.
  }
}

function getLastAppliedScreenCommandId(): string | null {
  try {
    return getStorage()?.getItem(DISPLAY_SCREEN_COMMAND_STORAGE_KEY) ?? null
  } catch {
    return null
  }
}

function rememberAppliedScreenCommandId(id: string) {
  try {
    getStorage()?.setItem(DISPLAY_SCREEN_COMMAND_STORAGE_KEY, id)
  } catch {
    // Remote controls continue to work when browser storage is unavailable.
  }
}

export function useDisplayControl(
  url = DEFAULT_DISPLAY_CONTROL_URL,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
) {
  const [initialCache] = useState(restoreDisplayControl)
  const { setSleepMode, setClosedMode } = useSleepMode()
  const { setVisualization, setFullscreen } = useVisualization()
  const { showScreen, returnToPrimary, keyMap } = useScreenContext()
  const handlersRef = useRef({
    setSleepMode,
    setClosedMode,
    setVisualization,
    setFullscreen,
    showScreen,
    returnToPrimary,
    keyMap,
  })

  const applyDesired = useCallback((snapshot: DisplayControlSnapshotV1) => {
    const handlers = handlersRef.current
    if (snapshot.desired.overlay === 'sleep') {
      handlers.setSleepMode(true)
    } else if (snapshot.desired.overlay === 'closed') {
      handlers.setClosedMode(true)
    } else {
      handlers.setSleepMode(false)
    }
    handlers.setVisualization(snapshot.desired.visualization)
    handlers.setFullscreen(snapshot.desired.visualizationMode === 'fullscreen')
  }, [])

  // Restore persistent desired state before the browser paints. Screen commands
  // are deliberately excluded because they are one-shot instructions.
  useLayoutEffect(() => {
    if (initialCache) applyDesired(initialCache.snapshot)
  }, [applyDesired, initialCache])

  // Keep the long-lived polling effect subscribed once while refreshing the
  // context callbacks it dispatches through. Updating a ref during render is
  // disallowed by React's refs rule, so synchronize it after commit.
  useEffect(() => {
    handlersRef.current = {
      setSleepMode,
      setClosedMode,
      setVisualization,
      setFullscreen,
      showScreen,
      returnToPrimary,
      keyMap,
    }
  }, [keyMap, returnToPrimary, setClosedMode, setFullscreen, setSleepMode, setVisualization, showScreen])

  useEffect(() => {
    let disposed = false
    let inFlight = false
    let retryAfterFlight = false
    let pollTimer: number | undefined
    let controller: AbortController | null = null
    let etag = initialCache?.etag ?? null
    let latestRevision = initialCache?.snapshot.revision ?? -1
    let lastScreenCommandId = initialCache?.snapshot.screenCommand?.id
      ?? getLastAppliedScreenCommandId()

    const clearPollTimer = () => {
      if (pollTimer !== undefined) window.clearTimeout(pollTimer)
      pollTimer = undefined
    }

    const applySnapshot = (snapshot: DisplayControlSnapshotV1) => {
      if (snapshot.revision <= latestRevision) return
      latestRevision = snapshot.revision

      applyDesired(snapshot)
      const handlers = handlersRef.current

      const command = snapshot.screenCommand
      if (!command || command.id === lastScreenCommandId) return

      // Record receipt before dispatch so a reload during a timed screen cannot
      // replay the same one-shot command.
      lastScreenCommandId = command.id
      rememberAppliedScreenCommandId(command.id)

      if (command.value === 'primary') {
        handlers.returnToPrimary()
        return
      }

      const screen = handlers.keyMap[command.value.toUpperCase()]
      if (screen) {
        handlers.showScreen(screen)
      } else {
        console.warn(`Display control: no screen found for key "${command.value}"`)
      }
    }

    const scheduleNextPoll = () => {
      clearPollTimer()
      if (!disposed && pollIntervalMs > 0) {
        pollTimer = window.setTimeout(fetchDisplayControl, pollIntervalMs)
      }
    }

    const fetchDisplayControl = async () => {
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
        if (etag) headers['If-None-Match'] = etag
        const response = await fetch(url, {
          cache: 'no-store',
          headers,
          signal: requestController.signal,
        })

        if (response.status === 304) return
        if (!response.ok) throw new Error(`Display control request failed (${response.status})`)

        const snapshot = parseDisplayControlSnapshot(await response.json())
        const responseEtag = response.headers.get('ETag') ?? null
        if (!disposed && snapshot.revision > latestRevision) {
          persistDisplayControl(snapshot, responseEtag)
          etag = responseEtag
          applySnapshot(snapshot)
        }
      } catch (error) {
        if (disposed) return
        if (error instanceof DOMException && error.name === 'AbortError' && !timedOut) return
        console.warn(
          timedOut
            ? 'Display control request timed out; retaining current display state'
            : 'Display control request failed; retaining current display state',
          error,
        )
      } finally {
        window.clearTimeout(abortTimer)
        if (controller === requestController) controller = null
        inFlight = false
        if (retryAfterFlight && !disposed) {
          retryAfterFlight = false
          void fetchDisplayControl()
        } else {
          scheduleNextPoll()
        }
      }
    }

    const retryNow = () => {
      if (disposed) return
      clearPollTimer()
      if (inFlight) retryAfterFlight = true
      else void fetchDisplayControl()
    }
    const retryWhenVisible = () => {
      if (document.visibilityState === 'visible') retryNow()
    }

    void fetchDisplayControl()
    window.addEventListener('online', retryNow)
    document.addEventListener('visibilitychange', retryWhenVisible)

    return () => {
      disposed = true
      clearPollTimer()
      controller?.abort()
      window.removeEventListener('online', retryNow)
      document.removeEventListener('visibilitychange', retryWhenVisible)
    }
  }, [applyDesired, initialCache, pollIntervalMs, url])
}
