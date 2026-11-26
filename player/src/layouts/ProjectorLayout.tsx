import { ProjectorOverlays } from '../components/ProjectorOverlays'
import { useLocation } from 'react-router-dom'
import { useSleepModeControls } from '../hooks/useSleepModeControls'
import { useDisplayControl } from '../hooks/useDisplayControl'
import { useSleepMode } from '../context/SleepModeContext'
import { useBeforeCafeOpens } from '../hooks/useBeforeCafeOpens'
import type { ProjectedMenuDocument } from '../lib/projectedMenu'
import { RabbitHoleLayout } from '../rabbitHole/RabbitHoleLayout'
import { HoleCanvas } from '../rabbitHole/HoleCanvas'
import { HoleEvent } from '../rabbitHole/HoleEvent'
import { ClubhouseNotice } from '../rabbitHole/ClubhouseNotice'
import { GulpHic } from '../rabbitHole/GulpHic'
import { useRabbitHole } from '../rabbitHole/useRabbitHole'
import { FeaturedLayout } from '../featured/FeaturedLayout'

interface ProjectorLayoutProps {
  /** The projected menu; the rabbit hole and the featured wall plan from it. */
  document?: ProjectedMenuDocument | null
}

/**
 * Projector layout - fullscreen, keyboard-controlled, no scrolling.
 * The rabbit hole when selected and it fits; otherwise the featured wall.
 */
export function ProjectorLayout({ document }: ProjectorLayoutProps) {
  const { search } = useLocation()

  useSleepModeControls()
  const { isClubhouseMode: clubhouseChosen, overlayMode } = useSleepMode()
  const beforeCafeOpens = useBeforeCafeOpens()
  // Before the café opens the clubhouse notice is the default; any overlay staff choose wins.
  const isClubhouseMode = clubhouseChosen || (overlayMode === 'none' && beforeCafeOpens)
  const displayControl = useDisplayControl()
  const rabbitHole = useRabbitHole({ document, search, displayControl })

  if (rabbitHole.active && rabbitHole.document) {
    return (
      <div className="projector-layout">
        <RabbitHoleLayout
          document={rabbitHole.document}
          background={
            <HoleCanvas variant={rabbitHole.variant} speed={rabbitHole.speed} speedTarget={rabbitHole.speedTarget} />
          }
          holeEvent={<HoleEvent variant={rabbitHole.variant} />}
          menuFooter={isClubhouseMode && <ClubhouseNotice />}
          overlays={<ProjectorOverlays />}
          stageRef={rabbitHole.stageRef}
          stageClassName={[rabbitHole.gulping && 'gulping', isClubhouseMode && 'clubhouse'].filter(Boolean).join(' ') || undefined}
          hic={<GulpHic />}
          onDoesNotFit={rabbitHole.onDoesNotFit}
          calibration={rabbitHole.calibration}
        />
      </div>
    )
  }

  if (rabbitHole.featured) {
    return (
      <div className="projector-layout">
        <FeaturedLayout
          document={rabbitHole.featured}
          calibration={rabbitHole.calibration}
          footer={isClubhouseMode && <ClubhouseNotice />}
          overlays={<ProjectorOverlays />}
          stageClassName={isClubhouseMode ? 'clubhouse' : undefined}
        />
      </div>
    )
  }

  // No v2 menu yet: a dark stage, overlays only.
  return (
    <div className="projector-layout" data-testid="projector-empty" style={{ background: '#000' }}>
      <ProjectorOverlays />
    </div>
  )
}
