import { useEffect, useState } from 'react'
import type { DisplayEffectCommand } from '../lib/displayControl'
import { commandReceipts } from '../lib/storage'
import type { GulpOptions } from './gulpController'

/** The last effectCommand id received; persisted like the screen command id. */
export const DISPLAY_EFFECT_COMMAND_STORAGE_KEY = 'white-rabbit:display-effect-command:v1'

/** Effect commands issued longer ago than this are ignored (SPEC §7.2 trigger 3). */
export const EFFECT_COMMAND_MAX_AGE_MS = 30_000

interface UseRemoteGulpOptions {
  /** `useGulp().gulp` (stable identity). */
  gulp: (options?: GulpOptions) => boolean
  /** `useDisplayControl().effectCommand`: the latest snapshot's, never restored from cache. */
  command: DisplayEffectCommand | null
}

/**
 * Remote gulps (SPEC §7.2 trigger 3): run a display-control
 * `effectCommand` once per `id`.
 *
 * - Receipt is recorded (memory + localStorage) before dispatch, so a reload
 *   mid-gulp or a re-delivered snapshot never replays it.
 * - A command issued more than 30s ago (or with an unparseable issuedAt) is
 *   recorded and ignored.
 * - Every command is consumed on receipt. If the gulp is refused (standard
 *   layout, menu not loaded yet, overlay, calibrating, reduced motion, 60s gap,
 *   already gulping) it is dropped, never queued.
 */
export function useRemoteGulp({ gulp, command }: UseRemoteGulpOptions) {
  const [receipts] = useState(() => commandReceipts(DISPLAY_EFFECT_COMMAND_STORAGE_KEY))
  const id = command?.id ?? null
  const issuedAt = command?.issuedAt ?? null

  useEffect(() => {
    if (id === null || issuedAt === null) return
    if (!receipts.receive(id)) return

    const age = Date.now() - Date.parse(issuedAt)
    if (!(age <= EFFECT_COMMAND_MAX_AGE_MS)) {
      console.warn(`Display control: ignoring stale effect command "${id}" (issued ${issuedAt})`)
      return
    }
    if (!gulp()) console.log(`Display control: effect command "${id}" refused; dropped, not queued`)
  }, [id, issuedAt, gulp, receipts])
}
