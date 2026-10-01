import type { ReactNode, Ref } from 'react'

export type StageLayer =
  | 'background'
  | 'hole-event'
  | 'menu'
  | 'hic'
  | 'hud'
  | 'overlays'
  | 'calibration-grid'

interface StageProps {
  /** The stage element is the root of the offset chain (see lib/stageOffset). */
  ref?: Ref<HTMLDivElement>
  /** Extra state classes, e.g. `gulping`. */
  className?: string
  children: ReactNode
}

/** The fixed 1920×1080 coordinate space. Every position inside is in stage px. */
export function Stage({ ref, className, children }: StageProps) {
  return (
    <div
      ref={ref}
      className={className ? `rh-stage ${className}` : 'rh-stage'}
      data-testid="rabbit-hole-stage"
    >
      {children}
    </div>
  )
}

/** One full-stage layer; the layer name fixes its place in the stacking order. */
export function StageLayer({ layer, children }: { layer: StageLayer; children: ReactNode }) {
  return (
    <div className={`rh-layer rh-layer-${layer}`} data-testid={`rabbit-hole-layer-${layer}`}>
      {children}
    </div>
  )
}
