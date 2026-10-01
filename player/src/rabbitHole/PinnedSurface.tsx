import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  defaultCorners,
  homographyMatrix3d,
  toViewportPx,
  type Corners,
} from '../lib/homography'

interface PinnedSurfaceProps {
  /** Normalized TL, TR, BR, BL. Absent means the default letterboxed 16:9 fit. */
  corners?: Corners | null
  /** The stage. */
  children: ReactNode
  /** Viewport-space overlays (sleep / closed / massage) above the pin, unwarped. */
  overlays?: ReactNode
  /** Viewport-space content drawn above the pin, unwarped (calibration handles). */
  viewport?: ReactNode
}

function useViewportSize() {
  const [size, setSize] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }))

  useEffect(() => {
    const update = () => setSize({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  return size
}

/**
 * The black viewport plus the 1920×1080 box carrying the corner-pin transform.
 * Calibrated and uncalibrated output share this one code path.
 */
export function PinnedSurface({ corners, children, overlays, viewport }: PinnedSurfaceProps) {
  const { width, height } = useViewportSize()
  const transform = useMemo(
    () => homographyMatrix3d(toViewportPx(corners ?? defaultCorners(width, height), width, height)),
    [corners, width, height],
  )

  return (
    <div className="rh-root">
      <div className="rh-pin" data-testid="pinned-surface" style={{ transform }}>
        {children}
      </div>
      <div className="rh-overlays" data-testid="rabbit-hole-overlays">{overlays}</div>
      {viewport && <div className="rh-viewport">{viewport}</div>}
    </div>
  )
}
