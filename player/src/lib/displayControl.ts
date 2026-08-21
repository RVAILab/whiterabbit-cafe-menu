import type { VisualizationType } from '../context/VisualizationContext'

export type DisplayOverlay = 'none' | 'sleep' | 'closed'
export type DisplayVisualizationMode = 'background' | 'fullscreen'

export interface DisplayControlDesiredV1 {
  overlay: DisplayOverlay
  visualization: VisualizationType
  visualizationMode: DisplayVisualizationMode
}

export interface DisplayScreenCommandV1 {
  id: string
  value: string
  issuedAt: string
}

export interface DisplayControlSnapshotV1 {
  schemaVersion: 1
  revision: number
  updatedAt: string
  desired: DisplayControlDesiredV1
  screenCommand: DisplayScreenCommandV1 | null
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const hasExactlyKeys = (value: Record<string, unknown>, keys: string[]) => {
  const actualKeys = Object.keys(value)
  return actualKeys.length === keys.length && keys.every((key) => key in value)
}

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0

const isIsoTimestamp = (value: unknown): value is string =>
  isNonEmptyString(value)
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value)
  && !Number.isNaN(Date.parse(value))

const isDesired = (value: unknown): value is DisplayControlDesiredV1 =>
  isRecord(value)
  && hasExactlyKeys(value, ['overlay', 'visualization', 'visualizationMode'])
  && (value.overlay === 'none' || value.overlay === 'sleep' || value.overlay === 'closed')
  && (
    value.visualization === 'none'
    || value.visualization === 'bubbles'
    || value.visualization === 'geometric'
    || value.visualization === 'waveforms'
  )
  && (value.visualizationMode === 'background' || value.visualizationMode === 'fullscreen')

const isScreenCommand = (value: unknown): value is DisplayScreenCommandV1 =>
  isRecord(value)
  && hasExactlyKeys(value, ['id', 'value', 'issuedAt'])
  && isNonEmptyString(value.id)
  && isNonEmptyString(value.value)
  && isIsoTimestamp(value.issuedAt)

/** Parse an entire v1 snapshot before any part of it is allowed to affect the display. */
export function parseDisplayControlSnapshot(value: unknown): DisplayControlSnapshotV1 {
  if (
    !isRecord(value)
    || !hasExactlyKeys(value, ['schemaVersion', 'revision', 'updatedAt', 'desired', 'screenCommand'])
    || value.schemaVersion !== 1
    || typeof value.revision !== 'number'
    || !Number.isSafeInteger(value.revision)
    || value.revision < 0
    || !isIsoTimestamp(value.updatedAt)
    || !isDesired(value.desired)
    || (value.screenCommand !== null && !isScreenCommand(value.screenCommand))
  ) {
    throw new Error('Display control response does not match schema version 1')
  }

  return value as unknown as DisplayControlSnapshotV1
}
