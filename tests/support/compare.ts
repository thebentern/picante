import { PNG } from 'pngjs'

/**
 * Image comparison for the raster export tests.
 *
 * These metrics are deliberately not the app's own code: the point of the
 * comparison is that two independently written paths agree on where the glyphs
 * land. tests/unit/compare.test.ts pins their sensitivity against a synthetic
 * reflow, so the thresholds in raster.spec.ts are grounded rather than guessed.
 */

/**
 * Ink that one image has and the other has nowhere within `radius` pixels.
 *
 * A plain XOR is the wrong metric for 1-bit output: two correct renders of the
 * same layout still disagree along every glyph boundary, and at 6.5 pt most ink
 * pixels *are* boundary pixels — a faithful pair diverges by ~10%. What actually
 * matters is displacement. A wrapped or shifted line puts ink where the other
 * image has none for many pixels around, and that survives the tolerance;
 * sub-pixel resampling jitter does not.
 */
export function displacedInk(
  a: PNG,
  b: PNG,
  width: number,
  height: number,
  radius = 2,
  search = 3,
): { fraction: number; count: number; ink: number; offset: [number, number] } {
  const ink = (img: PNG, x: number, y: number) =>
    x >= 0 && y >= 0 && x < width && y < height && img.data[(y * width + x) * 4] === 0

  // Register the two images first. Both are honest renders of the same layout,
  // but they come off different rasterizers and land a pixel or two apart; a
  // whole-image offset is not the defect this is looking for. Search for the
  // shift that agrees best, then measure what is still displaced at that shift.
  let best: [number, number] = [0, 0]
  let bestScore = Infinity
  for (let dy = -search; dy <= search; dy++) {
    for (let dx = -search; dx <= search; dx++) {
      let score = 0
      // Every 3rd pixel: enough signal to pick the offset, 9x less work.
      for (let y = 0; y < height; y += 3) {
        for (let x = 0; x < width; x += 3) {
          if (ink(a, x, y) !== ink(b, x + dx, y + dy)) score++
        }
      }
      if (score < bestScore) {
        bestScore = score
        best = [dx, dy]
      }
    }
  }

  const [ox, oy] = best
  const nearB = (x: number, y: number) => {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) if (ink(b, x + ox + dx, y + oy + dy)) return true
    }
    return false
  }
  const nearA = (x: number, y: number) => {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) if (ink(a, x - ox + dx, y - oy + dy)) return true
    }
    return false
  }

  let count = 0
  let total = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const inA = ink(a, x, y)
      const inB = ink(b, x, y)
      if (inA || inB) total++
      if (inA && !nearB(x, y)) count++
      else if (inB && !nearA(x, y)) count++
    }
  }
  return { fraction: total === 0 ? 0 : count / total, count, ink: total, offset: best }
}

/**
 * Bilinear resample to an exact size.
 *
 * Playwright rounds an element screenshot's device-pixel rect outward, so its
 * capture of a 234.33 x 377.94 CSS box at 4x comes back 944 x 1516 where the
 * app's rasterizer produces 937 x 1511. Left alone that 0.75% scale difference
 * accumulates into several pixels of drift down the label and swamps any real
 * comparison. Normalizing the source size first makes the two paths actually
 * comparable.
 */
export function resampleTo(src: PNG, width: number, height: number): PNG {
  const out = new PNG({ width, height })
  const sx = src.width / width
  const sy = src.height / height
  for (let y = 0; y < height; y++) {
    const fy = Math.min(src.height - 1, (y + 0.5) * sy - 0.5)
    const y0 = Math.max(0, Math.floor(fy))
    const y1 = Math.min(src.height - 1, y0 + 1)
    const wy = fy - y0
    for (let x = 0; x < width; x++) {
      const fx = Math.min(src.width - 1, (x + 0.5) * sx - 0.5)
      const x0 = Math.max(0, Math.floor(fx))
      const x1 = Math.min(src.width - 1, x0 + 1)
      const wx = fx - x0
      const j = (y * width + x) * 4
      for (let c = 0; c < 4; c++) {
        const p00 = src.data[(y0 * src.width + x0) * 4 + c]!
        const p10 = src.data[(y0 * src.width + x1) * 4 + c]!
        const p01 = src.data[(y1 * src.width + x0) * 4 + c]!
        const p11 = src.data[(y1 * src.width + x1) * 4 + c]!
        const top = p00 + (p10 - p00) * wx
        const bottom = p01 + (p11 - p01) * wx
        out.data[j + c] = Math.round(top + (bottom - top) * wy)
      }
    }
  }
  return out
}

/** Aspect-preserving fit of a source box into a target box, centred. */
export function fitBox(sw: number, sh: number, tw: number, th: number) {
  const scale = Math.min(tw / sw, th / sh)
  const dw = Math.round(sw * scale)
  const dh = Math.round(sh * scale)
  return { dx: Math.round((tw - dw) / 2), dy: Math.round((th - dh) / 2), dw, dh }
}

/**
 * The app's downsample + threshold, reimplemented here on purpose.
 *
 * Sharing the implementation would make the comparison circular — the point is
 * that two independently written paths agree on where the glyphs land.
 */
export function thresholdDownsample(source: PNG, width: number, height: number): PNG {
  const out = new PNG({ width, height })
  out.data.fill(255)
  const box = fitBox(source.width, source.height, width, height)
  const sx = source.width / box.dw
  const sy = source.height / box.dh

  for (let y = 0; y < box.dh; y++) {
    const y0 = Math.floor(y * sy)
    const y1 = Math.max(y0 + 1, Math.floor((y + 1) * sy))
    for (let x = 0; x < box.dw; x++) {
      const x0 = Math.floor(x * sx)
      const x1 = Math.max(x0 + 1, Math.floor((x + 1) * sx))
      let r = 0, g = 0, b = 0, n = 0
      for (let yy = y0; yy < y1 && yy < source.height; yy++) {
        for (let xx = x0; xx < x1 && xx < source.width; xx++) {
          const i = (yy * source.width + xx) * 4
          r += source.data[i]!
          g += source.data[i + 1]!
          b += source.data[i + 2]!
          n++
        }
      }
      const v = 0.299 * (r / n) + 0.587 * (g / n) + 0.114 * (b / n) < 150 ? 0 : 255
      const j = ((y + box.dy) * width + (x + box.dx)) * 4
      out.data[j] = v
      out.data[j + 1] = v
      out.data[j + 2] = v
      out.data[j + 3] = 255
    }
  }
  return out
}
