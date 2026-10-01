import { useMemo, type ReactNode, type Ref } from 'react'
import type { Corners } from '../lib/homography'
import { planPlates } from '../lib/platePlanner'
import type { ProjectedMenuDocument } from '../lib/projectedMenu'
import { PinnedSurface } from './PinnedSurface'
import { RabbitHoleHud } from './RabbitHoleHud'
import { RabbitHoleMenu } from './RabbitHoleMenu'
import { Stage, StageLayer } from './Stage'
import './rabbitHole.css'

export interface RabbitHoleLayoutProps {
  /** The menu document to show (the gulp may hold back a newer one). */
  document: ProjectedMenuDocument
  /** Normalized calibration corners; absent means the default letterbox fit. */
  corners?: Corners | null
  /** Hole variant canvas (z 0). */
  background?: ReactNode
  /** Next event at the hole center (z 1). */
  holeEvent?: ReactNode
  /** Gulp "*hic*" (z 3). */
  hic?: ReactNode
  /** Sleep / closed / massage overlays (z 5). */
  overlays?: ReactNode
  /** Calibration grid; warps with the pin (z 6). */
  calibrationGrid?: ReactNode
  /** Viewport-space content outside the pin (calibration handles, help card). */
  viewport?: ReactNode
  /** Stage state classes, e.g. `gulping`. */
  stageClassName?: string
  stageRef?: Ref<HTMLDivElement>
}

/**
 * The rabbit hole: a 1920×1080 stage on a pinned surface, the hole zone on the
 * left (x 0–600) and the live menu on three plates on the right.
 */
export function RabbitHoleLayout({
  document,
  corners,
  background,
  holeEvent,
  hic,
  overlays,
  calibrationGrid,
  viewport,
  stageClassName,
  stageRef,
}: RabbitHoleLayoutProps) {
  const plates = useMemo(() => planPlates(document), [document])

  return (
    <PinnedSurface corners={corners} viewport={viewport}>
      <Stage ref={stageRef} className={stageClassName}>
        <StageLayer layer="background">{background}</StageLayer>
        <StageLayer layer="hole-event">{holeEvent}</StageLayer>
        <StageLayer layer="menu"><RabbitHoleMenu plates={plates} /></StageLayer>
        <StageLayer layer="hic">{hic}</StageLayer>
        <StageLayer layer="hud"><RabbitHoleHud /></StageLayer>
        <StageLayer layer="overlays">{overlays}</StageLayer>
        <StageLayer layer="calibration-grid">{calibrationGrid}</StageLayer>
      </Stage>
    </PinnedSurface>
  )
}
