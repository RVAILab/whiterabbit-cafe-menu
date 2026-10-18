import type { ProjectedMenuDocument } from './projectedMenu'

/** Base type sizes (`--fs`, stage px) auto-fit tries, largest first; 26 is the legibility floor. */
export const FIT_SIZES = [32, 30, 28, 26] as const

/** One plate's measured box. */
export interface PlateBox {
  scrollHeight: number
  clientHeight: number
}

export type FitResult = { fits: true; fs: number } | { fits: false; fs: number }

/** A plate overflows when its content is taller than its box (1px of slack for rounding). */
export const plateOverflows = ({ scrollHeight, clientHeight }: PlateBox) => scrollHeight > clientHeight + 1

/**
 * Pick the largest base size at which no plate overflows. `measureAt(fs)`
 * applies `fs` and returns the plates' boxes; it is injected so the decision
 * can be tested without layout. Returns `fits: false` at the floor when even
 * the smallest size overflows.
 */
export function fitBaseSize(
  measureAt: (fs: number) => PlateBox[],
  sizes: readonly number[] = FIT_SIZES,
): FitResult {
  for (const fs of sizes) {
    if (!measureAt(fs).some(plateOverflows)) return { fits: true, fs }
  }
  return { fits: false, fs: sizes[sizes.length - 1] }
}

/**
 * What a menu's fit depends on: its content, not when it was generated. Two
 * polls of the same menu share a signature, so a menu that did not fit stays
 * on the standard layout until the content changes.
 */
export function menuFitSignature(document: ProjectedMenuDocument): string {
  return JSON.stringify({ ...document, generatedAt: undefined })
}

/** Next event title sizes (stage px) the hole tries, largest first; 26 matches the menu's floor. */
export const EVENT_TITLE_SIZES = [58, 54, 50, 46, 42, 38, 34, 30, 26] as const

/** The title's height budget: two lines at 58px × 1.05, the block's footprint in the hole. */
export const EVENT_TITLE_MAX_HEIGHT = 122

/** The title's measured box at one size. */
export interface TitleBox {
  height: number
  scrollWidth: number
  clientWidth: number
}

/**
 * Pick the largest title size at which the whole title fits the hole: no
 * taller than `maxHeight`, and no single word wider than the block. Returns
 * `fits: false` at the floor; the title then shows in full anyway, taller.
 */
export function fitEventTitle(
  measureAt: (fs: number) => TitleBox,
  sizes: readonly number[] = EVENT_TITLE_SIZES,
  maxHeight = EVENT_TITLE_MAX_HEIGHT,
): FitResult {
  for (const fs of sizes) {
    const { height, scrollWidth, clientWidth } = measureAt(fs)
    if (height <= maxHeight + 1 && scrollWidth <= clientWidth + 1) return { fits: true, fs }
  }
  return { fits: false, fs: sizes[sizes.length - 1] }
}
