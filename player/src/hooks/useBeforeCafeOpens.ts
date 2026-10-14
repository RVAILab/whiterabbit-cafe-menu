import { useEffect, useState } from 'react'
import { beforeCafeOpens } from '../lib/cafeHours'

const REFRESH_MS = 60_000

/** `beforeCafeOpens`, rechecked every minute so the wall changes over at 10am by itself. */
export function useBeforeCafeOpens(): boolean {
  const [before, setBefore] = useState(() => beforeCafeOpens(new Date()))

  useEffect(() => {
    const interval = window.setInterval(() => setBefore(beforeCafeOpens(new Date())), REFRESH_MS)
    return () => window.clearInterval(interval)
  }, [])

  return before
}
