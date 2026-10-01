import { drawDive } from './variants/dive'

/**
 * Hole variant registry (SPEC §6). A variant is a background renderer plus
 * its hole center and the label over the next event.
 *
 * Adding one (vortex #22, later burrow/clocks/shaft/doors): write a pure
 * `draw` in `variants/`, add its id to `HoleVariantId`, register it below.
 */
export type HoleVariantId = 'dive' // #22 adds 'vortex'

export interface HoleVariant {
  id: HoleVariantId
  /** Shown in the POS picker. */
  label: string
  /** Stage px. Both v1 variants use (300, 520). */
  holeCenter: [number, number]
  /** Over the next event at the hole. */
  eventLabel: string
  /**
   * Pure draw of one frame on the 1920×1080 stage canvas. `t` is the
   * accumulated, speed-scaled phase in seconds — never wall-clock time.
   */
  draw(ctx: CanvasRenderingContext2D, t: number, holeCenter: [number, number]): void
  /** Default 'plates'. 'doors' will need its own layout later. */
  layout?: 'plates'
}

export const HOLE_VARIANTS: Record<HoleVariantId, HoleVariant> = {
  dive: {
    id: 'dive',
    label: 'Dive',
    holeCenter: [300, 520],
    eventLabel: 'Next down the hole',
    draw: drawDive,
  },
}

export const DEFAULT_HOLE_VARIANT: HoleVariantId = 'dive'

export const isHoleVariantId = (value: unknown): value is HoleVariantId =>
  typeof value === 'string' && Object.hasOwn(HOLE_VARIANTS, value)

const warnedUnknown = new Set<string>()

/** The registered variant for `id`; anything unknown falls back to `dive` (warned once per id). */
export function getHoleVariant(id: string | null | undefined): HoleVariant {
  if (isHoleVariantId(id)) return HOLE_VARIANTS[id]
  if (id != null && !warnedUnknown.has(id)) {
    warnedUnknown.add(id)
    console.warn(`Unknown hole variant "${id}"; using "${DEFAULT_HOLE_VARIANT}".`)
  }
  return HOLE_VARIANTS[DEFAULT_HOLE_VARIANT]
}
