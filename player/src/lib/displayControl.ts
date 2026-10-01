import type { VisualizationType } from '../context/VisualizationContext'
import type { ProjectionLayout } from './effectiveLayout'

export type DisplayOverlay = 'none' | 'sleep' | 'closed' | 'massage'
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

// ---- Schema v2 (SPEC §8; the contract shared with WR-POS) ----

export type HoleVariantId = 'dive' | 'vortex'

export const HOLE_VARIANT_IDS: readonly HoleVariantId[] = ['dive', 'vortex']
export const RABBIT_HOLE_SPEED_MIN = 0.2
export const RABBIT_HOLE_SPEED_MAX = 1

export interface RabbitHoleGulpSettings {
  enabled: boolean
  /** Minutes between scheduled gulps; > 0. */
  intervalMinutes: number
  /** Gulp when the projected menu changes. */
  onMenuChange: boolean
}

export interface RabbitHoleSettings {
  /** An unknown variant from the server is normalized to `dive` (with a warning). */
  variant: HoleVariantId
  /** 0.2..1; 1 = prototype speed. */
  speed: number
  gulp: RabbitHoleGulpSettings
}

export interface DisplayControlDesiredV2 extends DisplayControlDesiredV1 {
  layout: ProjectionLayout
  rabbitHole: RabbitHoleSettings
}

/** A one-shot remote effect trigger. Consumers must dedupe by `id` (see #27). */
export interface DisplayEffectCommand {
  id: string
  value: 'gulp'
  issuedAt: string
}

export type CalibrationCorner = [number, number]

/** Four normalized (0..1) viewport corners: TL, TR, BR, BL. */
export interface DisplayCalibration {
  version: 1
  corners: [CalibrationCorner, CalibrationCorner, CalibrationCorner, CalibrationCorner]
  updatedAt: string | null
}

export interface DisplayControlSnapshotV2 {
  schemaVersion: 2
  revision: number
  updatedAt: string
  desired: DisplayControlDesiredV2
  screenCommand: DisplayScreenCommandV1 | null
  effectCommand: DisplayEffectCommand | null
  calibration: DisplayCalibration | null
}

export type DisplayControlSnapshot = DisplayControlSnapshotV1 | DisplayControlSnapshotV2

/**
 * The display-control settings beyond overlay/visualization/screen command,
 * normalized across schema versions (v1 → standard layout, everything else null).
 */
export interface DisplayControlExtras {
  layout: ProjectionLayout
  rabbitHole: RabbitHoleSettings | null
  effectCommand: DisplayEffectCommand | null
  calibration: DisplayCalibration | null
}

export const NO_DISPLAY_CONTROL_EXTRAS: DisplayControlExtras = {
  layout: 'standard',
  rabbitHole: null,
  effectCommand: null,
  calibration: null,
}

export function displayControlExtras(snapshot: DisplayControlSnapshot): DisplayControlExtras {
  if (snapshot.schemaVersion === 1) return NO_DISPLAY_CONTROL_EXTRAS
  return {
    layout: snapshot.desired.layout,
    rabbitHole: snapshot.desired.rabbitHole,
    effectCommand: snapshot.effectCommand,
    calibration: snapshot.calibration,
  }
}

// ---- Validation ----

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

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const DESIRED_V1_KEYS = ['overlay', 'visualization', 'visualizationMode']

const hasValidDesiredV1Values = (value: Record<string, unknown>) =>
  (
    value.overlay === 'none'
    || value.overlay === 'sleep'
    || value.overlay === 'closed'
    || value.overlay === 'massage'
  )
  && (
    value.visualization === 'none'
    || value.visualization === 'bubbles'
    || value.visualization === 'geometric'
    || value.visualization === 'waveforms'
  )
  && (value.visualizationMode === 'background' || value.visualizationMode === 'fullscreen')

const isDesiredV1 = (value: unknown): value is DisplayControlDesiredV1 =>
  isRecord(value)
  && hasExactlyKeys(value, DESIRED_V1_KEYS)
  && hasValidDesiredV1Values(value)

const isGulp = (value: unknown): value is RabbitHoleGulpSettings =>
  isRecord(value)
  && hasExactlyKeys(value, ['enabled', 'intervalMinutes', 'onMenuChange'])
  && typeof value.enabled === 'boolean'
  && isFiniteNumber(value.intervalMinutes)
  && value.intervalMinutes > 0
  && typeof value.onMenuChange === 'boolean'

/** Variant is only checked as a string here; unknown ids are normalized afterwards. */
const isRabbitHole = (value: unknown): value is Omit<RabbitHoleSettings, 'variant'> & { variant: string } =>
  isRecord(value)
  && hasExactlyKeys(value, ['variant', 'speed', 'gulp'])
  && isNonEmptyString(value.variant)
  && isFiniteNumber(value.speed)
  && value.speed >= RABBIT_HOLE_SPEED_MIN
  && value.speed <= RABBIT_HOLE_SPEED_MAX
  && isGulp(value.gulp)

const isDesiredV2 = (value: unknown): value is DisplayControlDesiredV2 =>
  isRecord(value)
  && hasExactlyKeys(value, [...DESIRED_V1_KEYS, 'layout', 'rabbitHole'])
  && hasValidDesiredV1Values(value)
  && (value.layout === 'standard' || value.layout === 'rabbit-hole')
  && isRabbitHole(value.rabbitHole)

const isScreenCommand = (value: unknown): value is DisplayScreenCommandV1 =>
  isRecord(value)
  && hasExactlyKeys(value, ['id', 'value', 'issuedAt'])
  && isNonEmptyString(value.id)
  && isNonEmptyString(value.value)
  && isIsoTimestamp(value.issuedAt)

/** Effect values this player knows; others are ignored (forward compatibility), not rejected. */
const EFFECT_VALUES: readonly string[] = ['gulp'] satisfies DisplayEffectCommand['value'][]
const warnedEffectValues = new Set<string>()

const isUnitInterval = (value: unknown) => isFiniteNumber(value) && value >= 0 && value <= 1

const isCorner = (value: unknown): value is CalibrationCorner =>
  Array.isArray(value) && value.length === 2 && value.every(isUnitInterval)

const isCalibration = (value: unknown): value is DisplayCalibration =>
  isRecord(value)
  && hasExactlyKeys(value, ['version', 'corners', 'updatedAt'])
  && value.version === 1
  && Array.isArray(value.corners)
  && value.corners.length === 4
  && value.corners.every(isCorner)
  && (value.updatedAt === null || isIsoTimestamp(value.updatedAt))

const hasValidEnvelope = (value: Record<string, unknown>) =>
  typeof value.revision === 'number'
  && Number.isSafeInteger(value.revision)
  && value.revision >= 0
  && isIsoTimestamp(value.updatedAt)
  && (value.screenCommand === null || isScreenCommand(value.screenCommand))

function parseV1(value: Record<string, unknown>): DisplayControlSnapshotV1 {
  if (
    !hasExactlyKeys(value, ['schemaVersion', 'revision', 'updatedAt', 'desired', 'screenCommand'])
    || !hasValidEnvelope(value)
    || !isDesiredV1(value.desired)
  ) {
    throw new Error('Display control response does not match schema version 1')
  }
  return value as unknown as DisplayControlSnapshotV1
}

function parseV2(value: Record<string, unknown>): DisplayControlSnapshotV2 {
  if (
    !hasExactlyKeys(value, [
      'schemaVersion', 'revision', 'updatedAt', 'desired', 'screenCommand', 'effectCommand', 'calibration',
    ])
    || !hasValidEnvelope(value)
    || !isDesiredV2(value.desired)
    || (value.effectCommand !== null && !isScreenCommand(value.effectCommand))
    || (value.calibration !== null && !isCalibration(value.calibration))
  ) {
    throw new Error('Display control response does not match schema version 2')
  }

  let snapshot = value as unknown as DisplayControlSnapshotV2
  const { variant } = snapshot.desired.rabbitHole as { variant: string }
  if (!(HOLE_VARIANT_IDS as readonly string[]).includes(variant)) {
    console.warn(`Display control: unknown rabbit hole variant "${variant}"; using "dive"`)
    snapshot = {
      ...snapshot,
      desired: { ...snapshot.desired, rabbitHole: { ...snapshot.desired.rabbitHole, variant: 'dive' } },
    }
  }

  const effect = snapshot.effectCommand
  if (effect && !EFFECT_VALUES.includes(effect.value)) {
    if (!warnedEffectValues.has(effect.value)) {
      warnedEffectValues.add(effect.value)
      console.warn(`Display control: ignoring unknown effect command "${effect.value}"`)
    }
    snapshot = { ...snapshot, effectCommand: null }
  }
  return snapshot
}

/**
 * Parse an entire v1 or v2 snapshot before any part of it is allowed to affect
 * the display. Each version is validated strictly (exact keys, known values).
 */
export function parseDisplayControlSnapshot(value: unknown): DisplayControlSnapshot {
  if (isRecord(value) && value.schemaVersion === 1) return parseV1(value)
  if (isRecord(value) && value.schemaVersion === 2) return parseV2(value)
  throw new Error('Display control response has an unsupported schema version')
}
