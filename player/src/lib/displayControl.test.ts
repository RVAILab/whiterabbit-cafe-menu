import { describe, expect, it, vi } from 'vitest'
import { displayControlExtras, parseDisplayControlSnapshot } from './displayControl'

const validSnapshot = {
  schemaVersion: 1,
  revision: 7,
  updatedAt: '2026-08-12T18:00:00.000Z',
  desired: {
    overlay: 'closed',
    visualization: 'geometric',
    visualizationMode: 'fullscreen',
  },
  screenCommand: {
    id: 'screen-7',
    value: 'A',
    issuedAt: '2026-08-12T17:59:59.000Z',
  },
}

describe('parseDisplayControlSnapshot', () => {
  it('accepts a complete v1 snapshot', () => {
    expect(parseDisplayControlSnapshot(validSnapshot)).toEqual(validSnapshot)
    expect(parseDisplayControlSnapshot({ ...validSnapshot, screenCommand: null })).toEqual({
      ...validSnapshot,
      screenCommand: null,
    })
  })

  it.each(['none', 'sleep', 'closed', 'massage'])('accepts the %s overlay', (overlay) => {
    const snapshot = { ...validSnapshot, desired: { ...validSnapshot.desired, overlay } }
    expect(parseDisplayControlSnapshot(snapshot)).toEqual(snapshot)
  })

  it.each([
    { ...validSnapshot, revision: -1 },
    { ...validSnapshot, revision: 1.5 },
    { ...validSnapshot, updatedAt: 'today' },
    { ...validSnapshot, desired: { ...validSnapshot.desired, overlay: 'dim' } },
    { ...validSnapshot, desired: { ...validSnapshot.desired, extra: true } },
    { ...validSnapshot, desired: { ...validSnapshot.desired, layout: 'rabbit-hole' } },
    { ...validSnapshot, screenCommand: { id: '', value: 'A', issuedAt: validSnapshot.updatedAt } },
    { ...validSnapshot, extra: true },
    { ...validSnapshot, effectCommand: null, calibration: null },
  ])('rejects malformed and non-exact snapshots', (snapshot) => {
    expect(() => parseDisplayControlSnapshot(snapshot)).toThrow(/schema version 1/)
  })

  it.each([0, 3, '2', undefined])('rejects unsupported schema version %s', (schemaVersion) => {
    expect(() => parseDisplayControlSnapshot({ ...validSnapshot, schemaVersion }))
      .toThrow(/schema version/)
  })
})

const validV2 = {
  schemaVersion: 2,
  revision: 167,
  updatedAt: '2026-09-30T18:00:00.000Z',
  desired: {
    overlay: 'none',
    visualization: 'bubbles',
    visualizationMode: 'background',
    layout: 'rabbit-hole',
    rabbitHole: {
      variant: 'vortex',
      speed: 0.4,
      gulp: { enabled: true, intervalMinutes: 15, onMenuChange: true },
    },
  },
  screenCommand: null,
  effectCommand: { id: 'effect-1', value: 'gulp', issuedAt: '2026-09-30T17:59:59.000Z' },
  calibration: {
    version: 1,
    corners: [[0.01, 0.02], [0.99, 0], [1, 1], [0, 0.98]],
    updatedAt: '2026-09-29T12:00:00.000Z',
  },
}

const withDesired = (patch: Record<string, unknown>) => ({
  ...validV2,
  desired: { ...validV2.desired, ...patch },
})
const withRabbitHole = (patch: Record<string, unknown>) =>
  withDesired({ rabbitHole: { ...validV2.desired.rabbitHole, ...patch } })
const withGulp = (patch: Record<string, unknown>) =>
  withRabbitHole({ gulp: { ...validV2.desired.rabbitHole.gulp, ...patch } })
const withCalibration = (patch: Record<string, unknown>) => ({
  ...validV2,
  calibration: { ...validV2.calibration, ...patch },
})
const withEffect = (patch: Record<string, unknown>) => ({
  ...validV2,
  effectCommand: { ...validV2.effectCommand, ...patch },
})
const without = (value: Record<string, unknown>, key: string) => {
  const copy = { ...value }
  delete copy[key]
  return copy
}

describe('parseDisplayControlSnapshot (schema v2)', () => {
  it('accepts a complete v2 snapshot', () => {
    expect(parseDisplayControlSnapshot(validV2)).toEqual(validV2)
  })

  it('accepts the standard layout, null extras and a null calibration timestamp', () => {
    const snapshot = {
      ...withDesired({ layout: 'standard' }),
      screenCommand: { id: 'screen-1', value: 'calibrate', issuedAt: validV2.updatedAt },
      effectCommand: null,
      calibration: { ...validV2.calibration, updatedAt: null },
    }
    expect(parseDisplayControlSnapshot(snapshot)).toEqual(snapshot)
    const noCalibration = { ...validV2, calibration: null }
    expect(parseDisplayControlSnapshot(noCalibration)).toEqual(noCalibration)
  })

  it('accepts both ends of the speed range', () => {
    expect(() => parseDisplayControlSnapshot(withRabbitHole({ speed: 0.2 }))).not.toThrow()
    expect(() => parseDisplayControlSnapshot(withRabbitHole({ speed: 1 }))).not.toThrow()
  })

  it('falls back to the dive variant, with a warning, for an unknown variant', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const parsed = parseDisplayControlSnapshot(withRabbitHole({ variant: 'burrow' }))
    expect(displayControlExtras(parsed).rabbitHole?.variant).toBe('dive')
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('burrow'))
    warn.mockRestore()
  })

  it('ignores an effect command with an unknown value, warning once, and keeps the rest', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const snapshot = withEffect({ value: 'sneeze' })
    const parsed = parseDisplayControlSnapshot(snapshot)
    expect(parsed).toEqual({ ...validV2, effectCommand: null })
    parseDisplayControlSnapshot({ ...snapshot, revision: 2 })
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('sneeze'))
    warn.mockRestore()
  })

  it.each([
    ['an extra top-level key', { ...validV2, extra: true }],
    ['a missing effect command key', without(validV2, 'effectCommand')],
    ['a missing calibration key', without(validV2, 'calibration')],
    ['an extra desired key', withDesired({ extra: true })],
    ['a missing layout', { ...validV2, desired: without(validV2.desired, 'layout') }],
    ['an unknown layout', withDesired({ layout: 'doors' })],
    ['a bad overlay', withDesired({ overlay: 'dim' })],
    ['a null rabbit hole', withDesired({ rabbitHole: null })],
    ['an extra rabbit hole key', withRabbitHole({ extra: 1 })],
    ['an empty variant', withRabbitHole({ variant: '' })],
    ['a speed below range', withRabbitHole({ speed: 0.1 })],
    ['a speed above range', withRabbitHole({ speed: 1.5 })],
    ['a string speed', withRabbitHole({ speed: '0.4' })],
    ['a non-boolean gulp flag', withGulp({ enabled: 'yes' })],
    ['a non-boolean menu-change flag', withGulp({ onMenuChange: 1 })],
    ['a zero gulp interval', withGulp({ intervalMinutes: 0 })],
    ['an extra gulp key', withGulp({ extra: true })],
    ['an effect without an id', withEffect({ id: '' })],
    ['a bad effect timestamp', withEffect({ issuedAt: 'now' })],
    ['an extra effect key', withEffect({ extra: true })],
    ['a calibration version 2', withCalibration({ version: 2 })],
    ['three corners', withCalibration({ corners: validV2.calibration.corners.slice(0, 3) })],
    ['a corner outside 0..1', withCalibration({ corners: [[0, 0], [1.2, 0], [1, 1], [0, 1]] })],
    ['a three-number corner', withCalibration({ corners: [[0, 0, 0], [1, 0], [1, 1], [0, 1]] })],
    ['a bad calibration timestamp', withCalibration({ updatedAt: 'yesterday' })],
    ['an extra calibration key', withCalibration({ extra: 1 })],
    ['a bad screen command', { ...validV2, screenCommand: { id: 'x', value: '', issuedAt: validV2.updatedAt } }],
  ])('rejects %s', (_label, snapshot) => {
    expect(() => parseDisplayControlSnapshot(snapshot)).toThrow(/schema version 2/)
  })
})

describe('displayControlExtras', () => {
  it('normalizes a v1 snapshot to the standard layout with no extras', () => {
    expect(displayControlExtras(parseDisplayControlSnapshot(validSnapshot))).toEqual({
      layout: 'standard',
      rabbitHole: null,
      effectCommand: null,
      calibration: null,
    })
  })

  it('exposes the v2 layout, rabbit hole settings, effect command and calibration', () => {
    expect(displayControlExtras(parseDisplayControlSnapshot(validV2))).toEqual({
      layout: 'rabbit-hole',
      rabbitHole: validV2.desired.rabbitHole,
      effectCommand: validV2.effectCommand,
      calibration: validV2.calibration,
    })
  })
})
