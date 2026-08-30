import { describe, expect, it } from 'vitest'
import { fitBox, LABEL_TARGETS, luma, THRESHOLD, threshold } from '../../src/export/raster'

describe('raster geometry', () => {
  it('targets the QL-500 printable grid, not the media size', () => {
    // 696 px at 300 dpi is 58.9 mm — the printable width for 62 mm media, not
    // the full 62 mm. Getting this wrong is what makes a label import at the
    // wrong size.
    expect(LABEL_TARGETS[300]).toMatchObject({ width: 696, height: 1109 })
    expect(LABEL_TARGETS[600]).toMatchObject({ width: 1392, height: 2218 })
    expect(LABEL_TARGETS[600].width).toBe(LABEL_TARGETS[300].width * 2)
    expect(LABEL_TARGETS[600].height).toBe(LABEL_TARGETS[300].height * 2)
  })

  it('oversamples enough that every downsample is a genuine reduction', () => {
    // Rendering 600 dpi at 4x would mean upscaling 936 px to 1392 px, which
    // throws away the entire point of the 600 dpi export.
    for (const dpi of [300, 600] as const) {
      const t = LABEL_TARGETS[dpi]
      const sourceWidth = 234 * t.renderScale
      expect(sourceWidth).toBeGreaterThan(t.width)
    }
  })

  it('fits and centres without cropping', () => {
    const box = fitBox(936, 1512, 696, 1109)
    expect(box.dh).toBe(1109)
    expect(box.dw).toBeLessThanOrEqual(696)
    // Rounding can leave the content half a pixel off centre; anything more
    // would mean it is being cropped on one side.
    expect(Math.abs(box.dx * 2 + box.dw - 696)).toBeLessThanOrEqual(1)
  })
})

describe('1-bit threshold', () => {
  it('uses Rec. 601 luma', () => {
    expect(luma(255, 255, 255)).toBeCloseTo(255)
    expect(luma(0, 0, 0)).toBe(0)
    expect(luma(255, 0, 0)).toBeCloseTo(76.245)
  })

  it('snaps every pixel to pure black or white, fully opaque', () => {
    // Antialiased greys are what a thermal head dithers into mush.
    const data = new Uint8ClampedArray([
      149, 149, 149, 12, // just under the cut
      151, 151, 151, 200, // just over
      0, 0, 0, 0,
      255, 255, 255, 255,
    ])
    threshold(data)
    expect(Array.from(data)).toEqual([0, 0, 0, 255, 255, 255, 255, 255, 0, 0, 0, 255, 255, 255, 255, 255])
  })

  it('cuts at 150, the value tuned in the design phase', () => {
    expect(THRESHOLD).toBe(150)
    const at = (v: number) => {
      const d = new Uint8ClampedArray([v, v, v, 255])
      threshold(d)
      return d[0]
    }
    expect(at(149)).toBe(0)
    expect(at(150)).toBe(255)
  })
})
