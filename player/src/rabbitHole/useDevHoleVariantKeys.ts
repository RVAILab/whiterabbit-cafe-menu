import { useCallback, useState } from 'react'
import { useProjectorKeys } from '../hooks/useProjectorKeys'
import type { HoleVariantId } from './holeVariants'

/**
 * Shift+1 / Shift+2 arrive as `!` / `@`, so they never collide with the
 * visualization keys 1 and 2 (SPEC §9).
 */
const DEV_VARIANT_KEYS: Record<string, HoleVariantId> = {
  '!': 'dive',
  '@': 'vortex',
}

/**
 * Dev builds only: Shift+1 / Shift+2 switch the hole variant locally. Returns
 * the local choice, or `null`. It wins over URL and display control until
 * `baseVariant` (the URL / display-control variant) changes, then gives way.
 * Bubble phase, so calibration's capture listener swallows these keys while
 * calibrating.
 */
export function useDevHoleVariantKeys(enabled: boolean, baseVariant: HoleVariantId): HoleVariantId | null {
  const [variant, setVariant] = useState<HoleVariantId | null>(null)
  const [overriddenBase, setOverriddenBase] = useState(baseVariant)
  if (overriddenBase !== baseVariant) {
    setOverriddenBase(baseVariant)
    setVariant(null)
  }

  const onKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return
    const next = DEV_VARIANT_KEYS[event.key]
    if (!next) return
    event.preventDefault()
    setVariant(next)
  }, [])
  useProjectorKeys(onKeyDown, { enabled: enabled && !!import.meta.env.DEV })

  return variant
}
