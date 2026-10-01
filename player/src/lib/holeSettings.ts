import { DEFAULT_HOLE_VARIANT, getHoleVariant, type HoleVariantId } from '../rabbitHole/holeVariants'

export const DEFAULT_HOLE_SPEED = 0.4
/** Display-control v2 speed range; 1 = prototype speed. */
export const MIN_HOLE_SPEED = 0.2
export const MAX_HOLE_SPEED = 1
/** `?speed=` range: wider than display control, for testing on the wall. */
export const MIN_URL_HOLE_SPEED = 0.05
export const MAX_URL_HOLE_SPEED = 5

export interface HoleSettings {
  variant: HoleVariantId
  speed: number
}

export interface HoleSettingsInputs {
  /** `location.search`; `?variant=` and `?speed=` (0.05–5) override everything. */
  search: string
  /** Display-control `desired.rabbitHole` (v2 only; #22 feeds it). */
  desired?: { variant?: string | null; speed?: number | null } | null
}

function parseSpeed(value: unknown, min: number, max: number): number | null {
  if (value == null || value === '') return null
  const speed = Number(value)
  if (!Number.isFinite(speed) || speed <= 0) return null
  return Math.min(max, Math.max(min, speed))
}

/**
 * The hole variant and speed: URL override, then display control, then
 * `dive` at 0.4. An unknown variant falls back to `dive` with a warning.
 */
export function resolveHoleSettings({ search, desired }: HoleSettingsInputs): HoleSettings {
  const params = new URLSearchParams(search)
  const variantId = params.get('variant') ?? desired?.variant ?? DEFAULT_HOLE_VARIANT
  return {
    variant: getHoleVariant(variantId).id,
    speed: parseSpeed(params.get('speed'), MIN_URL_HOLE_SPEED, MAX_URL_HOLE_SPEED)
      ?? parseSpeed(desired?.speed, MIN_HOLE_SPEED, MAX_HOLE_SPEED)
      ?? DEFAULT_HOLE_SPEED,
  }
}
