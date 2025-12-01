import { useState, useEffect, useRef } from 'react'
import { client, ACTIVE_BOARD_QUERY } from '../lib/sanity'
import type { KioskSettings, MenuData } from '../types'

/**
 * Custom hook for fetching and listening to real-time menu data from Sanity
 *
 * Features:
 * - Initial data fetch on mount
 * - Real-time updates via Sanity listener
 * - Offline resilience (maintains last known good state)
 * - Automatic reconnection
 */
export function useMenuData(): MenuData {
  const [data, setData] = useState<KioskSettings | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Store last successful data for offline mode
  const lastGoodDataRef = useRef<KioskSettings | null>(null)

  // Ref to track subscription and prevent double-mounting in StrictMode
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null)

  // Ref to track debounce timer for re-fetching
  const refetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // Initial fetch
    const fetchInitialData = async () => {
      try {
        setIsLoading(true)
        // Query returns an array, get the first element (singleton)
        const result = await client.fetch<KioskSettings[]>(ACTIVE_BOARD_QUERY)
        const kioskSettings = result[0]

        if (kioskSettings && kioskSettings.activeBoard) {
          setData(kioskSettings)
          lastGoodDataRef.current = kioskSettings
          setError(null)
        } else {
          throw new Error('No active board configured in Sanity')
        }
      } catch (err) {
        console.error('Failed to fetch initial menu data:', err)
        setError(err instanceof Error ? err.message : 'Failed to load menu')

        // If we have cached data, continue showing it
        if (lastGoodDataRef.current) {
          setData(lastGoodDataRef.current)
        }
      } finally {
        setIsLoading(false)
      }
    }

    fetchInitialData()

    // Set up real-time listener (guard against double-subscription in StrictMode)
    // Listen to changes on kioskSettings, menuBoard, and menuItem document types
    // since the query includes references to these documents
    if (!subscriptionRef.current) {
      console.log('🔧 Setting up Sanity listener')
      console.log('  Watching document types: kioskSettings, menuBoard, menuItem, menuModifier')
      console.log('  Perspective:', client.config().perspective)
      console.log('  API Version:', client.config().apiVersion)
      console.log('  CDN Disabled:', !client.config().useCdn)

      // Listen to all document types that can affect the menu
      const listenerQuery = '*[_type in ["kioskSettings", "menuBoard", "menuItem", "menuModifier"]]'

      subscriptionRef.current = client
        .listen(listenerQuery, {}, { includeResult: false })
        .subscribe({
          next: (update: any) => {
            // Ignore draft document changes (we only care about published docs)
            if (update.documentId?.startsWith('drafts.')) {
              console.log('⏭️ Skipping draft update:', update.documentId)
              return
            }

            console.log('📡 Received update from Sanity:', {
              type: update.type,
              documentId: update.documentId,
              mutations: update.mutations,
            })

            // Debounce re-fetch to avoid race conditions from rapid updates
            if (refetchTimerRef.current) {
              clearTimeout(refetchTimerRef.current)
            }

            refetchTimerRef.current = setTimeout(() => {
              console.log('🔄 Re-fetching menu data...')

              // When any relevant document changes, re-fetch the full menu data
              client.fetch<KioskSettings[]>(ACTIVE_BOARD_QUERY)
                .then(result => {
                  const kioskSettings = result[0]
                  if (kioskSettings?.activeBoard) {
                    console.log('✅ Menu data updated successfully')
                    console.log('📦 New data:', JSON.stringify(kioskSettings, null, 2))
                    setData(kioskSettings)
                    lastGoodDataRef.current = kioskSettings
                    setError(null)
                    setIsLoading(false)
                  }
                })
                .catch(err => {
                  console.error('❌ Failed to re-fetch menu data:', err)
                })
            }, 500) // 500ms debounce
          },
          error: (err) => {
            console.error('❌ Listener error:', err)
            console.error('  Error type:', err?.constructor?.name)
            console.error('  Error message:', err?.message)
            // Don't clear data on listener error - maintain last known state
            // This is important for offline resilience
            setError('Connection lost - showing last known menu')
          },
        })
    }

    // Cleanup subscription and timer on unmount
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe()
        subscriptionRef.current = null
      }
      if (refetchTimerRef.current) {
        clearTimeout(refetchTimerRef.current)
        refetchTimerRef.current = null
      }
    }
  }, [])

  return {
    kioskSettings: data,
    isLoading,
    error,
  }
}
