import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { ProjectedMenuDocument } from '../lib/projectedMenu'
import type { Gulp } from './useGulp'

type Doc = ProjectedMenuDocument | null | undefined

interface UseMenuChangeGulpOptions {
  /** The latest projected menu from the poller. */
  document: Doc
  /**
   * Hold menu changes for a gulp: the rabbit hole is on screen (not fallen
   * back) and display control has not turned `onMenuChange` off. Off:
   * `document` passes straight through, and the next enable starts from the
   * then-current document without a gulp.
   */
  enabled: boolean
  /** From useGulp: the trigger and live state (stable), and the rendered phase (re-runs at re-arm). */
  gulp: Pick<Gulp, 'gulp' | 'getState' | 'phase'>
}

/** The document on screen, outside React state so effects and onSwallowed can set it. */
function createShownStore(initial: Doc) {
  let shown = initial
  const listeners = new Set<() => void>()
  return {
    get: () => shown,
    set(next: Doc) {
      if (next === shown) return
      shown = next
      listeners.forEach((listener) => listener())
    },
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
  }
}

/**
 * Menu changes land inside the gulp (SPEC §7.2 #2): sits between the polled
 * projected menu and the rabbit hole layout and returns the document to
 * render there.
 *
 * - The first document is shown at once (initial load or cache restore).
 * - A new `availabilityRevision` is held back and passed as the gulp's
 *   `onSwallowed`, so it is swapped in at 1300ms while the menu is invisible.
 * - Refused (60s gap, overlay, reduced motion, calibrating, no stage): applied now.
 * - More changes before the swap point merge into it; the latest wins.
 * - Changes while any gulp is running but past (or without) our swap wait for
 *   re-arm, then go through the same path, usually refused by the gap and
 *   applied at once.
 * - Disabled (standard layout, auto-fit fallback, `onMenuChange: false`):
 *   pass-through, and nothing is remembered, so re-enabling shows the current
 *   document at once (a menu that overflowed is never gulped back in). A gulp
 *   cancelled mid-flight runs its onSwallowed, so the latest is never lost.
 */
export function useMenuChangeGulp({ document, enabled, gulp }: UseMenuChangeGulpOptions): Doc {
  const [store] = useState(() => createShownStore(enabled ? document : null))
  const shown = useSyncExternalStore(store.subscribe, store.get)
  const latestRef = useRef(document)
  /** Our gulp is accepted and its swap point hasn't come yet. */
  const swapPendingRef = useRef(false)
  const { gulp: trigger, getState, phase } = gulp

  useEffect(() => {
    latestRef.current = document
    if (!enabled) {
      store.set(null)
      return
    }
    const current = store.get()
    if (!document || !current) {
      store.set(document)
      return
    }
    if (document.availabilityRevision === current.availabilityRevision) return
    if (swapPendingRef.current) return // merges into the pending swap
    // Another gulp (or our release) is running: retry at re-arm. Read the
    // controller, not `phase`: a gulp started this tick isn't rendered yet.
    if (getState().phase !== 'idle') return

    const accepted = trigger({
      onSwallowed: () => {
        swapPendingRef.current = false
        store.set(latestRef.current)
      },
    })
    if (accepted) swapPendingRef.current = true
    else store.set(document)
  }, [document, enabled, phase, trigger, getState, store])

  return enabled ? (shown ?? document) : document
}
