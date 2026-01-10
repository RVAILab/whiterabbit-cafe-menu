import { useNowPlaying } from '../hooks/useNowPlaying'

interface NowPlayingWidgetProps {
  visible: boolean
}

export function NowPlayingWidget({ visible }: NowPlayingWidgetProps) {
  const { nowPlaying, isLoading, error } = useNowPlaying({
    enabled: visible,
    pollInterval: parseInt(import.meta.env.VITE_SONOS_POLL_INTERVAL || '3000', 10),
  })

  const isPlaying = nowPlaying?.playbackState === 'PLAYBACK_STATE_PLAYING'
  const track = nowPlaying?.track

  if (!visible || isLoading || error || !isPlaying || !track) {
    return null
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '2vw',
        left: '2vw',
        display: 'flex',
        alignItems: 'center',
        gap: '1vw',
        padding: '1vw',
        backgroundColor: 'rgba(10, 10, 10, 0.9)',
        borderRadius: '0.5vw',
        border: '2px solid rgba(255, 255, 255, 0.3)',
        zIndex: 100,
        maxWidth: '25vw',
        fontFamily: "'PP Pangram Sans Rounded', system-ui, sans-serif",
      }}
    >
      {track.imageUrl && (
        <img
          src={track.imageUrl}
          alt="Album art"
          style={{
            width: '4vw',
            height: '4vw',
            borderRadius: '0.3vw',
            objectFit: 'cover',
            flexShrink: 0,
          }}
        />
      )}

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.2vw',
          overflow: 'hidden',
          minWidth: 0,
        }}
      >
        <span
          style={{
            fontSize: '0.8vw',
            fontWeight: 700,
            color: '#7ed957',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          Now Playing
        </span>

        <span
          style={{
            fontSize: '1.2vw',
            fontWeight: 700,
            color: '#ffffff',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {track.name}
        </span>

        <span
          style={{
            fontSize: '1vw',
            fontWeight: 700,
            color: '#ff4d9f',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {track.artist.name}
        </span>
      </div>
    </div>
  )
}
