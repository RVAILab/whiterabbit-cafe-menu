import { useVisualization } from '../context/VisualizationContext'
import { Bubbles } from './Bubbles'
import { Geometric } from './Geometric'

/**
 * Renders the active background visualization.
 * This component should be placed behind menu content.
 */
export function VisualizationLayer() {
  const { activeVisualization } = useVisualization()

  if (activeVisualization === 'none') {
    return null
  }

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
      }}
    >
      {activeVisualization === 'bubbles' && <Bubbles />}
      {activeVisualization === 'geometric' && <Geometric />}
    </div>
  )
}
