import { useEffect } from 'react'

interface ProjectorKeysOptions {
  /** Listen only while true (default true). */
  enabled?: boolean
  /**
   * Where to listen (default `window`). `document` in the bubble phase runs
   * before every `window` bubble listener, so stopPropagation() there wins.
   */
  target?: 'window' | 'document'
  /** Capture phase: runs before every bubble listener (calibration owns the keyboard this way). */
  capture?: boolean
}

const isTyping = (event: KeyboardEvent) =>
  event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement

/**
 * A projector keydown listener: skips keys typed into inputs, and adds/removes
 * itself with `enabled` and `onKeyDown` (keep it stable with useCallback).
 */
export function useProjectorKeys(
  onKeyDown: (event: KeyboardEvent) => void,
  { enabled = true, target = 'window', capture = false }: ProjectorKeysOptions = {},
) {
  useEffect(() => {
    if (!enabled) return
    const node = target === 'document' ? document : window
    const listener = (event: Event) => {
      if (event instanceof KeyboardEvent && !isTyping(event)) onKeyDown(event)
    }
    node.addEventListener('keydown', listener, { capture })
    return () => node.removeEventListener('keydown', listener, { capture })
  }, [onKeyDown, enabled, target, capture])
}
