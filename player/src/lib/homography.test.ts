import { describe, expect, it } from 'vitest'
import {
  STAGE_HEIGHT,
  STAGE_WIDTH,
  defaultCorners,
  homographyMatrix3d,
  toViewportPx,
  type Corners,
} from './homography'

/** Apply a CSS matrix3d (column-major) to a stage point, as the browser does. */
function applyMatrix3d(css: string, [x, y]: [number, number]): [number, number] {
  const m = css.replace(/^matrix3d\(|\)$/g, '').split(',').map(Number)
  expect(m).toHaveLength(16)
  const X = m[0] * x + m[4] * y + m[12]
  const Y = m[1] * x + m[5] * y + m[13]
  const W = m[3] * x + m[7] * y + m[15]
  return [X / W, Y / W]
}

const STAGE_CORNERS: Corners = [
  [0, 0],
  [STAGE_WIDTH, 0],
  [STAGE_WIDTH, STAGE_HEIGHT],
  [0, STAGE_HEIGHT],
]

describe('homographyMatrix3d', () => {
  it('turns the default letterbox fit into a pure scale plus translate', () => {
    const css = homographyMatrix3d(toViewportPx(defaultCorners(1280, 1024), 1280, 1024))
    const m = css.replace(/^matrix3d\(|\)$/g, '').split(',').map(Number)

    // No shear and no perspective terms.
    expect(m[1]).toBeCloseTo(0, 9)
    expect(m[4]).toBeCloseTo(0, 9)
    expect(m[3]).toBeCloseTo(0, 9)
    expect(m[7]).toBeCloseTo(0, 9)
    // 1280 / 1920 on both axes, centred vertically: (1024 - 720) / 2 = 152.
    expect(m[0]).toBeCloseTo(2 / 3, 9)
    expect(m[5]).toBeCloseTo(2 / 3, 9)
    expect(m[12]).toBeCloseTo(0, 9)
    expect(m[13]).toBeCloseTo(152, 9)
  })

  it.each<[string, Corners]>([
    ['the projector keystone case (TR pulled down)', [[40, 30], [1850, 140], [1890, 1050], [20, 1070]]],
    ['a strong trapezoid', [[300, 100], [1600, 0], [1920, 1080], [0, 900]]],
    ['a rotated quad', [[200, 50], [1800, 250], [1650, 1030], [60, 830]]],
    ['a small inset quad', [[500, 400], [1100, 420], [1080, 760], [520, 700]]],
  ])('maps every stage corner to its target within 0.5px for %s', (_, target) => {
    const css = homographyMatrix3d(target)

    STAGE_CORNERS.forEach((corner, index) => {
      const [x, y] = applyMatrix3d(css, corner)
      expect(Math.abs(x - target[index][0])).toBeLessThan(0.5)
      expect(Math.abs(y - target[index][1])).toBeLessThan(0.5)
    })
  })
})

describe('defaultCorners', () => {
  it('fills a 16:9 viewport exactly', () => {
    expect(defaultCorners(1920, 1080)).toEqual([[0, 0], [1, 0], [1, 1], [0, 1]])
  })

  it('pillarboxes a wider viewport', () => {
    // 2560x1080: stage scale 1, 1920 wide, 320px bars each side.
    const corners = defaultCorners(2560, 1080)
    expect(toViewportPx(corners, 2560, 1080)).toEqual([
      [320, 0], [2240, 0], [2240, 1080], [320, 1080],
    ])
  })

  it('letterboxes a taller viewport', () => {
    // 1280x1024: scale 2/3, 1280x720, 152px bars top and bottom.
    const corners = defaultCorners(1280, 1024)
    const px = toViewportPx(corners, 1280, 1024)
    const expected = [[0, 152], [1280, 152], [1280, 872], [0, 872]]
    px.forEach(([x, y], index) => {
      expect(x).toBeCloseTo(expected[index][0], 9)
      expect(y).toBeCloseTo(expected[index][1], 9)
    })
  })
})
