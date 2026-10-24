import { useEffect } from 'react'

const CHECK_INTERVAL_MS = 5 * 60_000
const REQUEST_TIMEOUT_MS = 10_000
const RELOADED_FOR_KEY = 'white-rabbit:reloaded-for-build'

/** The hashed entry script a built index.html loads (`/assets/index-<hash>.js`), or null. */
export function entryScript(html: string): string | null {
  return html.match(/\/assets\/index-[\w-]+\.js/)?.[0] ?? null
}

/** The entry script this page is running, read from its own <script> tag. */
function runningEntryScript(): string | null {
  const src = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/index-"]')?.src
  return src ? entryScript(src) : null
}

function readReloadedFor(): string | null {
  try { return sessionStorage.getItem(RELOADED_FOR_KEY) } catch { return null }
}

function writeReloadedFor(script: string) {
  try { sessionStorage.setItem(RELOADED_FOR_KEY, script) } catch { /* reload anyway */ }
}

/**
 * The wall runs for days without anyone touching its browser, so a deploy
 * (a new hole variant, a fix) would otherwise wait for a manual refresh.
 * Every 5 minutes this fetches index.html; when it names a different entry
 * script than the one running, the page reloads onto the new build.
 * Calibration and the cached menu live in localStorage and survive it.
 * A reload that still lands on the old build (a stale cache) is not repeated
 * for the same new build.
 */
export function useReloadOnNewDeploy(enabled: boolean, intervalMs = CHECK_INTERVAL_MS) {
  useEffect(() => {
    const running = enabled ? runningEntryScript() : null
    if (!running) return

    const check = async () => {
      try {
        const res = await fetch(`/index.html?build-check=${Date.now()}`, {
          cache: 'no-store',
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        })
        if (!res.ok) return
        const latest = entryScript(await res.text())
        if (!latest || latest === running || latest === readReloadedFor()) return
        writeReloadedFor(latest)
        window.location.reload()
      } catch {
        // offline or slow: try again next interval
      }
    }

    const id = window.setInterval(check, intervalMs)
    return () => window.clearInterval(id)
  }, [enabled, intervalMs])
}
