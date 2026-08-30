import { expect, test } from '@playwright/test'
import { createHash } from 'node:crypto'
import { PNG } from 'pngjs'
import {
  openApp,
  setPreview,
  setZoom,
  downloadBytes,
  thresholdDownsample,
  displacedInk,
  resampleTo,
} from './helpers'

/**
 * The handoff's warning about the raster path is specific: a rasterizer that
 * mis-measures text will silently wrap a line, and you only see it in the PNG.
 * "Verify the output visually" has to be something CI does rather than
 * something we remember to do — so this drives the real export button on the
 * production build and then renders the same label a second, independent way to
 * diff against.
 *
 *   A. The app's pipeline: modern-screenshot → downsample → threshold → pHYs.
 *   B. Playwright's compositor screenshot, put through the same downsample and
 *      threshold here in Node.
 *
 * A wrapped line moves thousands of pixels, so it cannot survive the diff.
 */

const TARGETS = [
  { dpi: 300 as const, button: 'PNG · 300 dpi', width: 696, height: 1109, ppm: 11811 },
  { dpi: 600 as const, button: 'PNG · 600 dpi', width: 1392, height: 2218, ppm: 23622 },
]

/** Read the pHYs chunk back out of a PNG. */
function readDensity(png: Buffer) {
  let offset = 8
  while (offset + 8 <= png.length) {
    const length = png.readUInt32BE(offset)
    const type = png.subarray(offset + 4, offset + 8).toString('latin1')
    if (type === 'pHYs') {
      return {
        x: png.readUInt32BE(offset + 8),
        y: png.readUInt32BE(offset + 12),
        unit: png[offset + 16],
      }
    }
    if (type === 'IEND') break
    offset += 12 + length
  }
  return null
}

test.describe('label raster export', () => {
  for (const target of TARGETS) {
    test(`${target.dpi} dpi is exactly ${target.width} × ${target.height}, 1-bit, and tagged`, async ({
      page,
    }) => {
      await openApp(page, 'label')
      await setPreview(page)
      await page.getByRole('tab', { name: 'Print' }).click()

      const bytes = await downloadBytes(page, target.button)

      const density = readDensity(bytes)
      // Physical density is what makes P-touch Editor place the image at label
      // size instead of guessing. Canvas does not write it; the app splices it
      // in, and without it the acceptance criterion is luck rather than fact.
      expect(density).toEqual({ x: target.ppm, y: target.ppm, unit: 1 })

      const decoded = PNG.sync.read(bytes)
      expect(decoded.width).toBe(target.width)
      expect(decoded.height).toBe(target.height)

      // 1-bit means every channel is 0 or 255 and nothing is translucent: a
      // thermal head dithers anything in between into mush.
      const offenders = new Set<number>()
      let black = 0
      for (let i = 0; i < decoded.data.length; i += 4) {
        for (const c of [0, 1, 2]) {
          const v = decoded.data[i + c]!
          if (v !== 0 && v !== 255) offenders.add(v)
        }
        if (decoded.data[i + 3] !== 255) offenders.add(-1)
        if (decoded.data[i] === 0) black++
      }
      expect([...offenders].slice(0, 8)).toEqual([])

      // Neither blank nor a solid block.
      const inked = black / (target.width * target.height)
      expect(inked).toBeGreaterThan(0.02)
      expect(inked).toBeLessThan(0.6)
    })
  }

  test.describe('compositor comparison', () => {
    // Capture at the same 4x oversample the 300 dpi pipeline renders at, so both
    // sides are genuine reductions rather than one being an upscale.
    test.use({ deviceScaleFactor: 4 })

    test('matches an independent compositor render — no silently wrapped lines', async ({ page }) => {
    await openApp(page, 'label')
    await setPreview(page)
    // The compositor capture goes through the stage's CSS transform, so the
    // stage has to be at 1:1 for the two sides to be comparable. The app's own
    // path is zoom-independent by construction — see the test below.
    await setZoom(page, '1')
    await page.getByRole('tab', { name: 'Print' }).click()

    const appBytes = await downloadBytes(page, 'PNG · 300 dpi')
    const app = PNG.sync.read(appBytes)

    // The app renders at exactly the element's layout box times the oversample.
    // Playwright rounds its capture rect outward, so normalize to the same
    // source size before running the identical downsample.
    const source = await page.locator('#print-root .doc-page').evaluate((el) => ({
      width: (el as HTMLElement).offsetWidth * 4,
      height: (el as HTMLElement).offsetHeight * 4,
    }))
    const shot = await page
      .locator('#print-root .doc-page')
      .screenshot({ scale: 'device', type: 'png', animations: 'disabled' })
    const reference = thresholdDownsample(
      resampleTo(PNG.sync.read(shot), source.width, source.height),
      696,
      1109,
    )

    // Ink coverage first: a wrapped line changes how much ink is on the page.
    const inkOf = (png: PNG) => {
      let n = 0
      for (let i = 0; i < png.data.length; i += 4) if (png.data[i] === 0) n++
      return n / (696 * 1109)
    }
    expect(Math.abs(inkOf(app) - inkOf(reference))).toBeLessThan(0.01)

    // Then displacement: ink one side has and the other has nowhere nearby.
    const { fraction, count, ink, offset } = displacedInk(app, reference, 696, 1109)
    expect(
      fraction,
      `${count} of ${ink} ink pixels are displaced (${(fraction * 100).toFixed(2)}%) after ` +
        `registering at offset [${offset.join(', ')}] — a line has probably reflowed in the raster`,
      // tests/unit/compare.test.ts pins the separation this threshold sits in:
      // two honest renders of the same layout land near 3%, and a single
      // wrapped line lands near 19%.
    ).toBeLessThan(0.08)

    // A large registration offset is itself suspicious: the two paths should
    // land within a pixel or two of each other.
    expect(Math.abs(offset[0])).toBeLessThanOrEqual(3)
    expect(Math.abs(offset[1])).toBeLessThanOrEqual(3)
    })
  })

  test('PDF is one page at exactly 62 × 100 mm', async ({ page }) => {
    await openApp(page, 'label')
    await setPreview(page)
    await page.getByRole('tab', { name: 'Print' }).click()

    const bytes = await downloadBytes(page, 'PDF · exactly 62 × 100 mm')
    const source = bytes.toString('latin1')

    // Read the page geometry out of the file itself rather than through a
    // library: this asserts what a PDF reader will actually see.
    const boxes = [...source.matchAll(/\/MediaBox\s*\[\s*([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s*\]/g)]
    expect(boxes).toHaveLength(1)
    expect(source.match(/\/Type\s*\/Page[^s]/g) ?? []).toHaveLength(1)

    const [, x0, y0, x1, y1] = boxes[0]!.map(Number) as unknown as number[]
    // 62 mm = 175.748 pt, 100 mm = 283.465 pt.
    expect(Number(x1) - Number(x0)).toBeCloseTo(175.748, 2)
    expect(Number(y1) - Number(y0)).toBeCloseTo(283.465, 2)
  })

  test('output does not depend on the preview zoom', async ({ page }) => {
    // The card is rendered inside a `transform: scale()` stage. A rasterizer
    // that measures the on-screen rect instead of the layout box produces a
    // smaller source at any zoom below 100% and then upscales it to hit the
    // target — a blurred thermal print that still looks like a successful
    // export. Pinning width/height fixed that; this keeps it fixed.
    await openApp(page, 'label')
    await setPreview(page)
    await page.getByRole('tab', { name: 'Print' }).click()

    const digests: string[] = []
    for (const zoom of ['0.5', '1'] as const) {
      await setZoom(page, zoom)
      const bytes = await downloadBytes(page, 'PNG · 300 dpi')
      const decoded = PNG.sync.read(bytes)
      expect(decoded.width).toBe(696)
      digests.push(createHash('sha256').update(bytes).digest('hex'))
    }
    expect(digests[0]).toBe(digests[1])
  })

  test('exposes the exact geometry it produced', async ({ page }) => {
    await openApp(page, 'label')
    await setPreview(page)
    await page.getByRole('tab', { name: 'Print' }).click()
    await downloadBytes(page, 'PNG · 300 dpi')

    // The summary is what a user checks against P-touch's import dialog, so it
    // has to state the real numbers rather than the intended ones.
    await expect(page.getByText(/^696 × 1109 px, 1-bit, tagged 11811 px\/m \(300 dpi\)/)).toBeVisible()
  })
})

