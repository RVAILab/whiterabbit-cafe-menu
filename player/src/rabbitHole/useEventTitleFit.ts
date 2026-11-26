import { useLayoutEffect, type RefObject } from 'react'
import { EVENT_TITLE_MAX_HEIGHT, EVENT_TITLE_SIZES, fitEventTitle } from '../lib/autoFit'

/**
 * Shrink the next event title until all of it fits the hole (`fitEventTitle`).
 * Sets `--title-fs` on the title and, when even the floor is too big,
 * `data-fit="floor"` so long words may wrap. Measures with offsetHeight and
 * scroll/client widths, which the corner pin's transform does not affect.
 * Re-fits when the title changes and once web fonts load.
 */
export function useEventTitleFit(
  titleRef: RefObject<HTMLElement | null>,
  title: string | null,
  sizes: readonly number[] = EVENT_TITLE_SIZES,
  maxHeight = EVENT_TITLE_MAX_HEIGHT,
) {
  useLayoutEffect(() => {
    let disposed = false
    const fit = () => {
      const el = titleRef.current
      if (disposed || !el) return
      delete el.dataset.fit
      const result = fitEventTitle((fs) => {
        el.style.setProperty('--title-fs', `${fs}px`)
        return { height: el.offsetHeight, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }
      }, sizes, maxHeight)
      el.style.setProperty('--title-fs', `${result.fs}px`)
      if (!result.fits) el.dataset.fit = 'floor'
    }
    fit()
    globalThis.document?.fonts?.ready.then(fit, () => {})
    return () => {
      disposed = true
    }
  }, [titleRef, title, sizes, maxHeight])
}
