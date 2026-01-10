import { useState, useEffect, useRef, useCallback } from 'react'
import type { NowPlayingData, NowPlayingApiResponse } from '../types'

interface UseNowPlayingOptions {
  enabled: boolean
  pollInterval?: number
}

interface UseNowPlayingResult {
  nowPlaying: NowPlayingData | null
  isLoading: boolean
  error: string | null
}

export function useNowPlaying({
  enabled,
  pollInterval = 3000,
}: UseNowPlayingOptions): UseNowPlayingResult {
  const [nowPlaying, setNowPlaying] = useState<NowPlayingData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const sonosServerUrl = import.meta.env.VITE_SONOS_SERVER_URL
  const zoneId = import.meta.env.VITE_SONOS_ZONE_ID

  const fetchNowPlaying = useCallback(async () => {
    if (!sonosServerUrl || !zoneId) {
      setError('Sonos server not configured')
      setIsLoading(false)
      return
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()

    try {
      const response = await fetch(
        `${sonosServerUrl}/api/now-playing?zone_id=${zoneId}`,
        {
          headers: {
            'Cache-Control': 'no-cache',
          },
          signal: abortControllerRef.current.signal,
        }
      )

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data: NowPlayingApiResponse = await response.json()

      if (data.success) {
        const track = data.data.metadata?.currentItem?.track
        setNowPlaying({
          playbackState: data.data.playbackStatus.playbackState,
          track: track
            ? {
                name: track.name,
                artist: { name: track.artist.name },
                imageUrl: track.imageUrl,
              }
            : null,
        })
        setError(null)
      } else {
        setNowPlaying(null)
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return
      }
      console.error('Failed to fetch now playing:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch')
    } finally {
      setIsLoading(false)
    }
  }, [sonosServerUrl, zoneId])

  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    fetchNowPlaying()
    intervalRef.current = setInterval(fetchNowPlaying, pollInterval)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [enabled, fetchNowPlaying, pollInterval])

  return { nowPlaying, isLoading, error }
}
