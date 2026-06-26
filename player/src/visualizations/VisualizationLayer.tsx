import { useVisualization } from '../context/VisualizationContext'
import { Bubbles } from './Bubbles'
import { Geometric } from './Geometric'
import { Waveforms } from './Waveforms'

/**
 * Renders the active background visualization.
 * This component should be placed behind menu content.
 */
export function VisualizationLayer() {
  const { activeVisualization, isFullscreen } = useVisualization()

  if (activeVisualization === 'none') {
    return null
  }

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        // In fullscreen takeover the layer sits above the menu and widgets
        // (widgets are at zIndex 100) but below the sleep/closed overlays
        // (zIndex 9999). A solid background hides the menu text entirely.
        zIndex: isFullscreen ? 200 : 0,
        background: isFullscreen ? '#0a0a0a' : 'transparent',
        pointerEvents: 'none',
      }}
    >
      {activeVisualization === 'bubbles' && <Bubbles />}
      {activeVisualization === 'geometric' && <Geometric />}
      {activeVisualization === 'waveforms' && <Waveforms />}
    </div>
  )
}
