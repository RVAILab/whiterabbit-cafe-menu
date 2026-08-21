import { describe, expect, it } from 'vitest'
import { parseDisplayControlSnapshot } from './displayControl'

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

  it.each([
    { ...validSnapshot, schemaVersion: 2 },
    { ...validSnapshot, revision: -1 },
    { ...validSnapshot, revision: 1.5 },
    { ...validSnapshot, updatedAt: 'today' },
    { ...validSnapshot, desired: { ...validSnapshot.desired, overlay: 'dim' } },
    { ...validSnapshot, desired: { ...validSnapshot.desired, extra: true } },
    { ...validSnapshot, screenCommand: { id: '', value: 'A', issuedAt: validSnapshot.updatedAt } },
    { ...validSnapshot, extra: true },
  ])('rejects malformed and non-exact snapshots', (snapshot) => {
    expect(() => parseDisplayControlSnapshot(snapshot)).toThrow(/schema version 1/)
  })
})
