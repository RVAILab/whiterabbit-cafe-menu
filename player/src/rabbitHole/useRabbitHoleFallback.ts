import { useCallback, useMemo, useState } from 'react'
import { menuFitSignature } from '../lib/autoFit'
import type { ProjectedMenuDocument } from '../lib/projectedMenu'

/**
 * Fallback from the rabbit hole to the standard layout. `reportDoesNotFit`
 * marks the current menu as too large; `fellBack` stays true for that menu
 * (and re-polls of the same content) until a different menu arrives, which
 * gets a fresh try.
 */
export function useRabbitHoleFallback(document: ProjectedMenuDocument | null | undefined) {
  const signature = useMemo(() => (document ? menuFitSignature(document) : null), [document])
  const [unfitSignature, setUnfitSignature] = useState<string | null>(null)

  const reportDoesNotFit = useCallback(() => setUnfitSignature(signature), [signature])

  return { fellBack: signature !== null && signature === unfitSignature, reportDoesNotFit }
}
