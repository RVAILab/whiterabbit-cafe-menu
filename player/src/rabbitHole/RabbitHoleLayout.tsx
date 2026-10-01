import { useMemo, type ReactNode, type Ref } from 'react'
import type { CalibrationApi } from '../context/calibrationContext'
import { planPlates } from '../lib/platePlanner'
import type { ProjectedMenuDocument } from '../lib/projectedMenu'
import { CalibrationGrid, CalibrationHandles } from './Calibration'
import { PinnedSurface } from './PinnedSurface'
import { RabbitHoleHud } from './RabbitHoleHud'
import { RabbitHoleMenu } from './RabbitHoleMenu'
import { Stage, StageLayer } from './Stage'
import './rabbitHole.css'

export interface RabbitHoleLayoutProps {
  /** The menu document to show (the gulp may hold back a newer one). */
  document: ProjectedMenuDocument
  /**
   * Corner-pin calibration: `corners` (normalized; null = default letterbox
   * fit) and, while calibrating, the grid (warps with the pin, z 6) and the
   * viewport-space handles.
   */
  calibration?: Pick<CalibrationApi, 'corners' | 'isCalibrating' | 'selectedCorner' | 'selectCorner' | 'setCorner'>
  /** Hole variant canvas (z 0). */
  background?: ReactNode
  /** Next event at the hole center (z 1). */
  holeEvent?: ReactNode
  /** Gulp "*hic*" (z 3). */
  hic?: ReactNode
  /**
   * Sleep / closed / massage overlays. Drawn in viewport space outside the
   * pin, as in the standard layout: they are sized in vw and position: fixed,
   * so inside the scaled stage they would be scaled twice. This deviates from
   * SPEC §2 (overlays as stage layer z 5) until they are converted to stage units.
   */
  overlays?: ReactNode
  /** Stage state classes, e.g. `gulping`. */
  stageClassName?: string
  stageRef?: Ref<HTMLDivElement>
  /** Called (after a warning) when the menu overflows its plates even at the 26px floor. */
  onDoesNotFit?: () => void
}

/**
 * The rabbit hole: a 1920×1080 stage on a pinned surface, the hole zone on the
 * left (x 0–600) and the live menu on three plates on the right.
 */
export function RabbitHoleLayout({
  document,
  calibration,
  background,
  holeEvent,
  hic,
  overlays,
  stageClassName,
  stageRef,
  onDoesNotFit,
}: RabbitHoleLayoutProps) {
  const plates = useMemo(() => planPlates(document), [document])
  const calibrating = calibration?.isCalibrating ?? false

  return (
    <PinnedSurface
      corners={calibration?.corners}
      overlays={overlays}
      viewport={calibration?.isCalibrating && calibration.corners && (
        <CalibrationHandles
          corners={calibration.corners}
          selectedCorner={calibration.selectedCorner}
          onSelect={calibration.selectCorner}
          onMove={calibration.setCorner}
        />
      )}
    >
      <Stage ref={stageRef} className={stageClassName}>
        <StageLayer layer="background">{background}</StageLayer>
        <StageLayer layer="hole-event">{holeEvent}</StageLayer>
        <StageLayer layer="menu"><RabbitHoleMenu plates={plates} onDoesNotFit={onDoesNotFit} /></StageLayer>
        <StageLayer layer="hic">{hic}</StageLayer>
        <StageLayer layer="hud"><RabbitHoleHud /></StageLayer>
        <StageLayer layer="calibration-grid">{calibrating && <CalibrationGrid />}</StageLayer>
      </Stage>
    </PinnedSurface>
  )
}
