import type { Corners, Point } from './homography'
import { readStoredJson, writeStoredJson } from './storage'

/** SPEC §3.1: normalized viewport corners (TL, TR, BR, BL), so it survives resolution changes. */
export interface Calibration {
  version: 1
  corners: Corners
  updatedAt: string | null
}

export const CALIBRATION_STORAGE_KEY = 'white-rabbit:projection-calibration:v1'

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

export const clampPoint = ([x, y]: Point): Point => [clamp01(x), clamp01(y)]

const isFiniteNumber = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)

/** A stored or server calibration, or null when it is missing or malformed. */
export function parseCalibration(value: unknown): Calibration | null {
  if (typeof value !== 'object' || value === null) return null
  const { version, corners, updatedAt } = value as Record<string, unknown>
  if (version !== 1 || !Array.isArray(corners) || corners.length !== 4) return null
  if (!corners.every((p) => Array.isArray(p) && p.length === 2 && p.every(isFiniteNumber))) return null
  return {
    version: 1,
    corners: (corners as Point[]).map(clampPoint) as Corners,
    updatedAt: typeof updatedAt === 'string' ? updatedAt : null,
  }
}

export function loadCalibration(): Calibration | null {
  return parseCalibration(readStoredJson(CALIBRATION_STORAGE_KEY))
}

/** The calibration still applies for this session when storage is blocked. */
export function storeCalibration(calibration: Calibration) {
  writeStoredJson(CALIBRATION_STORAGE_KEY, calibration)
}
