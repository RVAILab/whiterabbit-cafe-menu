import { useLayoutEffect, useRef, type RefObject } from 'react'
import { fitBaseSize, type PlateBox } from '../lib/autoFit'

/** Every box that can overflow: the plates, and column 3's stack when the bar is on. */
export const PLATE_SELECTOR = '.rh-plate, .rh-stack'

/** Apply `fs` as the menu's `--fs` and read every plate's (and the stack's) box (forces a synchronous layout). */
export function measurePlatesAt(menu: HTMLElement, fs: number): PlateBox[] {
  menu.style.setProperty('--fs', `${fs}px`)
  return [...menu.querySelectorAll<HTMLElement>(PLATE_SELECTOR)].map((plate) => ({
    scrollHeight: plate.scrollHeight,
    clientHeight: plate.clientHeight,
  }))
}

/**
 * Auto-fit the rabbit hole menu: after each render of new `content`, set the
 * largest `--fs` (32 → 26) at which no plate or stack overflows. If one still
 * overflows at 26, warn and call `onDoesNotFit`. Re-fits once web fonts load,
 * since they change line heights.
 */
export function useAutoFit(
  menuRef: RefObject<HTMLElement | null>,
  content: unknown,
  onDoesNotFit?: () => void,
) {
  const onDoesNotFitRef = useRef(onDoesNotFit)
  useLayoutEffect(() => {
    onDoesNotFitRef.current = onDoesNotFit
  })

  useLayoutEffect(() => {
    let disposed = false
    const fit = () => {
      const menu = menuRef.current
      if (disposed || !menu) return
      const result = fitBaseSize((fs) => measurePlatesAt(menu, fs))
      menu.style.setProperty('--fs', `${result.fs}px`)
      if (!result.fits) {
        console.warn(
          `Menu does not fit the rabbit hole layout at ${result.fs}px; falling back to the standard layout.`,
        )
        onDoesNotFitRef.current?.()
      }
    }
    fit()
    globalThis.document?.fonts?.ready.then(fit, () => {})
    return () => {
      disposed = true
    }
  }, [menuRef, content])
}
