import { useState, useEffect, useRef, useCallback } from 'react'

interface UpcomingEventData {
  title: string
  startsAt: string
  imageUrl?: string
  venue?: string
}

interface UseUpcomingEventOptions {
  enabled: boolean
  pollInterval?: number
}

interface UseUpcomingEventResult {
  upcomingEvent: UpcomingEventData | null
  isLoading: boolean
  error: string | null
}

interface RovaEventInstance {
  title: string
  startsAt: string
  eventId: string
  venue?: { title: string }
}

interface RovaEvent {
  id: string
  primaryInfo?: {
    heroImage?: {
      urls?: {
        card?: string
        thumbnail?: string
      }
    }
  }
  heroImage?: {
    urls?: {
      card?: string
      thumbnail?: string
    }
  }
}

interface RovaEventsResponse {
  events: RovaEvent[]
  instances: RovaEventInstance[]
}

export function useUpcomingEvent({
  enabled,
  pollInterval = 60000, // Default to 1 minute since events don't change as often
}: UseUpcomingEventOptions): UseUpcomingEventResult {
  const [upcomingEvent, setUpcomingEvent] = useState<UpcomingEventData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const rovaApiKey = import.meta.env.VITE_ROVA_API_KEY
  const venueSlug = import.meta.env.VITE_ROVA_VENUE_SLUG || 'white-rabbit-clubhouse'

  const fetchUpcomingEvent = useCallback(async () => {
    if (!rovaApiKey) {
      setError('Rova API key not configured')
      setIsLoading(false)
      return
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()

    try {
      const url = new URL('https://rova.live/api/public/events')
      url.searchParams.append('venueSlug', venueSlug)
      // Need higher limit since limit is for events, not instances
      // The API already filters to future instances by default
      url.searchParams.append('limit', '10')

      const response = await fetch(url.toString(), {
        headers: {
          'x-api-key': rovaApiKey,
          'Accept': 'application/json',
        },
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data: RovaEventsResponse = await response.json()

      if (data.instances && data.instances.length > 0) {
        // Sort instances by startsAt to get the next upcoming event
        const sortedInstances = [...data.instances].sort(
          (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
        )
        const instance = sortedInstances[0]

        // Find the matching event to get the hero image
        const event = data.events?.find((e) => e.id === instance.eventId)

        // Get image URL from event's primaryInfo or top-level heroImage
        const heroImage = event?.primaryInfo?.heroImage || event?.heroImage
        const imageUrl = heroImage?.urls?.card || heroImage?.urls?.thumbnail

        setUpcomingEvent({
          title: instance.title,
          startsAt: instance.startsAt,
          imageUrl,
          venue: instance.venue?.title,
        })
        setError(null)
      } else {
        setUpcomingEvent(null)
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return
      }
      console.error('Failed to fetch upcoming event:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch')
    } finally {
      setIsLoading(false)
    }
  }, [rovaApiKey, venueSlug])

  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    fetchUpcomingEvent()
    intervalRef.current = setInterval(fetchUpcomingEvent, pollInterval)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [enabled, fetchUpcomingEvent, pollInterval])

  return { upcomingEvent, isLoading, error }
}
