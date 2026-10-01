/**
 * localStorage that never throws. Browsers can expose localStorage while
 * denying access to it, and quota or privacy settings can block writes; the
 * player keeps working from memory and the network either way.
 */

export function getStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

/** The stored string, or null when missing or storage is unavailable. */
export function readStorage(key: string): string | null {
  try {
    return getStorage()?.getItem(key) ?? null
  } catch {
    return null
  }
}

export function writeStorage(key: string, value: string) {
  try {
    getStorage()?.setItem(key, value)
  } catch {
    // Persistence is best effort.
  }
}

export function removeStorage(key: string) {
  try {
    getStorage()?.removeItem(key)
  } catch {
    // Persistence is best effort.
  }
}

/** The stored JSON value, or null when missing or unreadable; corrupt entries are removed. */
export function readStoredJson(key: string): unknown {
  const raw = readStorage(key)
  if (raw === null) return null
  try {
    return JSON.parse(raw) as unknown
  } catch {
    removeStorage(key)
    return null
  }
}

export function writeStoredJson(key: string, value: unknown) {
  writeStorage(key, JSON.stringify(value))
}

export interface CommandReceipts {
  /** True the first time `id` arrives; it is then recorded (memory + storage) before the caller dispatches. */
  receive(id: string): boolean
}

/**
 * Dedupe for one-shot display-control commands (screen and effect): remembers
 * the last id received under `key`, so a re-delivered snapshot or a reload
 * mid-command never replays it. `initialId` (e.g. from a cached snapshot)
 * stands in for the stored id; storage is read lazily otherwise.
 */
export function commandReceipts(key: string, initialId?: string | null): CommandReceipts {
  let lastId = initialId ?? undefined
  return {
    receive(id) {
      if (lastId === undefined) lastId = readStorage(key) ?? undefined
      if (id === lastId) return false
      lastId = id
      writeStorage(key, id)
      return true
    },
  }
}
