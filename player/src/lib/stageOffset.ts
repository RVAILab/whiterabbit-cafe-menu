import type { Point } from './homography'

/**
 * Centre of `element` in stage px, from the offsetLeft/offsetTop chain up to
 * `stage`. Never use getBoundingClientRect inside the pinned surface: it
 * returns the warped viewport geometry, not stage coordinates.
 */
export function stageCenterOf(element: HTMLElement, stage: HTMLElement): Point {
  let x = 0
  let y = 0
  let current: HTMLElement | null = element
  while (current && current !== stage) {
    x += current.offsetLeft
    y += current.offsetTop
    current = current.offsetParent as HTMLElement | null
  }
  return [x + element.offsetWidth / 2, y + element.offsetHeight / 2]
}
