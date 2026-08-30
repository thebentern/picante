import { describe, expect, it } from 'vitest'
import { PNG } from 'pngjs'
import { displacedInk, fitBox } from '../support/compare'

/**
 * The raster comparison in tests/e2e/raster.spec.ts only means something if its
 * metric actually moves when a line reflows. These pin that: the same synthetic
 * "label" compared against itself, against a 2 px registration offset (which it
 * must forgive, because two honest rasterizers land a pixel or two apart), and
 * against one wrapped line (which it must catch). The e2e threshold sits in the
 * gap those numbers leave.
 */

const W = 400
const H = 600
const LINE_HEIGHT = 27

function blank(): PNG {
  const png = new PNG({ width: W, height: H })
  png.data.fill(255)
  for (let i = 3; i < png.data.length; i += 4) png.data[i] = 255
  return png
}

function drawRow(png: PNG, y: number, x0: number, x1: number, thickness = 6) {
  for (let yy = y; yy < y + thickness && yy < H; yy++) {
    for (let x = x0; x < x1 && x < W; x++) {
      const i = (yy * W + x) * 4
      png.data[i] = 0
      png.data[i + 1] = 0
      png.data[i + 2] = 0
      png.data[i + 3] = 255
    }
  }
}

/** A stack of text-like bars, one per line. */
function page(lines: number[], offsetY = 0): PNG {
  const png = blank()
  lines.forEach((width, i) => drawRow(png, offsetY + 40 + i * LINE_HEIGHT, 20, 20 + width))
  return png
}

const LINES = [300, 280, 320, 260, 300, 240, 310, 290, 270, 300]

describe('raster comparison metrics', () => {
  it('sees an identical render as identical', () => {
    const a = page(LINES)
    const b = page(LINES)
    expect(displacedInk(a, b, W, H).fraction).toBe(0)
  })

  it('forgives a whole-image registration offset', () => {
    // Two honest rasterizers land a pixel or two apart. That is not a defect.
    const a = page(LINES)
    const b = page(LINES, 2)
    expect(displacedInk(a, b, W, H).fraction).toBeLessThan(0.04)
  })

  it('catches a single wrapped line', () => {
    // One line wraps: an extra line appears and everything below shifts down by
    // a line height. This is the failure the e2e comparison exists to find.
    const wrapped = [...LINES.slice(0, 4), 180, ...LINES.slice(4)]
    const a = page(LINES)
    const b = page(wrapped)
    // This is the separation the e2e threshold sits in: identical layouts score
    // near zero, a registration offset stays under 4%, and one wrapped line
    // lands an order of magnitude higher.
    const { fraction } = displacedInk(a, b, W, H)
    expect(fraction).toBeGreaterThan(0.15)
  })

  it('fits a source box into a target, centred', () => {
    // 936 x 1512 fits by height into 696 x 1109 at 687 wide, leaving ~4.5 px of
    // white each side — the same fit-and-centre the reference exports used.
    expect(fitBox(936, 1512, 696, 1109)).toEqual({ dx: 5, dy: 0, dw: 687, dh: 1109 })
    expect(fitBox(1872, 3024, 1392, 2218)).toEqual({ dx: 10, dy: 0, dw: 1373, dh: 2218 })
  })
})
