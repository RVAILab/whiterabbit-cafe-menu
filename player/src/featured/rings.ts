import { STAGE_HEIGHT, STAGE_WIDTH } from '../lib/homography'
import { strokePortalOutlines } from '../rabbitHole/variants/portal'

/** Where the rings come from: behind the drinks, between the coffee block and the grid. */
export const RINGS_CENTER: [number, number] = [760, 540]
/** The whole layer's strength: the rings sit behind text, so they stay faint. */
const STRENGTH = 0.3

/**
 * The rabbit hole's Portal look (the check-in kiosk's bands and rings), its
 * outlines only, on a transparent canvas: no black center, no black ground.
 * The edge fade is the .ft-rings mask. `t` is phase seconds.
 */
export function drawFeaturedRings(c: CanvasRenderingContext2D, t: number, center = RINGS_CENTER) {
  c.clearRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT)
  c.save()
  c.globalAlpha = STRENGTH
  strokePortalOutlines(c, t, center)
  c.restore()
}
