import { describe, expect, it } from 'vitest'
import { fitBaseSize, fitEventTitle, type PlateBox, type TitleBox } from './autoFit'

/** Plates that need `needed` px each at 32px type, shrinking in proportion to the type. */
const platesNeeding = (needed: number[], height = 800) => (fs: number): PlateBox[] =>
  needed.map((n) => ({ scrollHeight: Math.max(height, Math.round((n * fs) / 32)), clientHeight: height }))

describe('fitBaseSize', () => {
  it('keeps 32px when every plate fits', () => {
    expect(fitBaseSize(platesNeeding([500, 700, 800]))).toEqual({ fits: true, fs: 32 })
  })

  it('steps down by 2px until every plate fits', () => {
    // 900 at 32 -> 844 at 30 -> 788 at 28: the tallest plate fits at 28.
    expect(fitBaseSize(platesNeeding([500, 900, 600]))).toEqual({ fits: true, fs: 28 })
  })

  it('tries 26 as the floor', () => {
    // 980 at 32 -> 796 at 26.
    expect(fitBaseSize(platesNeeding([980]))).toEqual({ fits: true, fs: 26 })
  })

  it('does not fit when a plate still overflows at 26', () => {
    expect(fitBaseSize(platesNeeding([500, 1000, 500]))).toEqual({ fits: false, fs: 26 })
  })

  it('measures 32, 30, 28 and 26 in that order and stops at the first fit', () => {
    const tried: number[] = []
    fitBaseSize((fs) => { tried.push(fs); return platesNeeding([1000])(fs) })
    expect(tried).toEqual([32, 30, 28, 26])

    tried.length = 0
    fitBaseSize((fs) => { tried.push(fs); return platesNeeding([850])(fs) })
    expect(tried).toEqual([32, 30])
  })

  it('tolerates a 1px rounding overflow', () => {
    expect(fitBaseSize(() => [{ scrollHeight: 801, clientHeight: 800 }])).toEqual({ fits: true, fs: 32 })
    expect(fitBaseSize(() => [{ scrollHeight: 802, clientHeight: 800 }])).toEqual({ fits: false, fs: 26 })
  })
})

/** A title of `chars` characters in a 360px box: ~0.55em per character, 1.05 line height. */
const titleOf = (chars: number, longestWordChars = 6) => (fs: number): TitleBox => {
  const perLine = Math.floor(360 / (fs * 0.55))
  return {
    height: Math.ceil(chars / perLine) * fs * 1.05,
    scrollWidth: Math.max(360, Math.round(longestWordChars * fs * 0.55)),
    clientWidth: 360,
  }
}

describe('fitEventTitle', () => {
  it('keeps 58px for a title that fits two lines', () => {
    expect(fitEventTitle(titleOf(18))).toEqual({ fits: true, fs: 58 })
  })

  it('shrinks a long title until it fits the two-line height', () => {
    // 60 chars: 6 lines at 58 (365px), 5 at 34 (143px), 3 at 30 (95px).
    expect(fitEventTitle(titleOf(60))).toEqual({ fits: true, fs: 30 })
  })

  it('shrinks a word too wide for the hole', () => {
    // 14-char word: 446px at 58, 354px at 46.
    expect(fitEventTitle(titleOf(14, 14))).toEqual({ fits: true, fs: 46 })
  })

  it('does not fit at the 26px floor for a very long title', () => {
    expect(fitEventTitle(titleOf(300))).toEqual({ fits: false, fs: 26 })
  })
})
