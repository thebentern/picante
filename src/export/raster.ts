import { withDensity } from './png'

/**
 * The 62 x 100 mm label, rasterized for a Brother QL-500.
 *
 * Why raster at all: P-touch Editor ignores PDF page geometry and places a PDF
 * as a small floating image. A PNG at exact pixel dimensions, carrying a pHYs
 * density, imports 1:1.
 *
 * Why these dimensions: 696 px is the *printable* width for 62 mm die-cut media
 * (58.9 mm), not the full 62 mm, and 1109 px is the printable length. The label
 * is scaled to fit inside that box and centred on white, which is what the
 * known-good reference exports did.
 *
 * Why the threshold: the QL-500 is a 1-bit thermal device. Antialiased gray
 * edges get dithered by the print head into mush; hard black and white at 300
 * dpi is crisp. This step is not optional and it is not a nicety.
 *
 * Why not html2canvas: it reimplements layout and mis-measures text, which
 * silently wraps a line in the PNG that the live page does not have.
 * modern-screenshot renders through an SVG foreignObject, so the browser's own
 * layout engine does the measuring — the same engine that laid out the preview.
 * Fonts are self-hosted so they inline same-origin and cannot fall back
 * mid-render. tests/e2e/raster.spec.ts diffs the result against a Playwright
 * screenshot of the same element, because "verify it visually" needs to be
 * something CI does, not something we remember to do.
 */

export interface RasterTarget {
  dpi: number
  width: number
  height: number
  /**
   * Oversample factor for the source render. Always chosen so the downsample
   * step is a genuine reduction — rendering at 4x for 600 dpi would mean
   * *upscaling* 936 px to 1392 px, which throws away the whole point.
   */
  renderScale: number
}

export const LABEL_TARGETS: Record<300 | 600, RasterTarget> = {
  300: { dpi: 300, width: 696, height: 1109, renderScale: 4 },
  600: { dpi: 600, width: 1392, height: 2218, renderScale: 8 },
}

/** Luminance cut. Tuned in the design phase; do not drift it casually. */
export const THRESHOLD = 150

/** Rec. 601 luma, the same weighting the reference pipeline used. */
export const luma = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b

/** Snap every pixel to pure black or pure white, fully opaque. */
export function threshold(data: Uint8ClampedArray, cut = THRESHOLD): void {
  for (let i = 0; i < data.length; i += 4) {
    const v = luma(data[i]!, data[i + 1]!, data[i + 2]!) < cut ? 0 : 255
    data[i] = v
    data[i + 1] = v
    data[i + 2] = v
    data[i + 3] = 255
  }
}

/** Aspect-preserving fit of a source box into a target box, centred. */
export function fitBox(
  sourceW: number,
  sourceH: number,
  targetW: number,
  targetH: number,
): { dx: number; dy: number; dw: number; dh: number } {
  const scale = Math.min(targetW / sourceW, targetH / sourceH)
  const dw = Math.round(sourceW * scale)
  const dh = Math.round(sourceH * scale)
  return { dx: Math.round((targetW - dw) / 2), dy: Math.round((targetH - dh) / 2), dw, dh }
}

async function toPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('The browser could not encode the label as a PNG.')
  return new Uint8Array(await blob.arrayBuffer())
}

/**
 * Render `element` to a 1-bit PNG at the given target.
 *
 * Exported so the e2e test can call the exact same code path the app uses,
 * rather than a reimplementation of it that could drift.
 */
export interface RasterResult {
  bytes: Uint8Array
  width: number
  height: number
  /**
   * The thresholded pixels, before PNG encoding. The WebUSB path needs the raw
   * dots and re-decoding a PNG to get them back would be silly — and at 300 dpi
   * the 696 x 1109 raster is *exactly* the QL-500's printable dot grid for
   * 62 x 100 mm media, so the same pixels drive both exports.
   */
  image: ImageData
}

export async function rasterizeLabel(
  element: HTMLElement,
  target: RasterTarget,
): Promise<RasterResult> {
  // Width and height are pinned to the element's own layout box, not its
  // on-screen rect. The editor renders the card inside a `transform: scale()`
  // stage, and without this the rasterizer measures the *scaled* rect: at the
  // default 65% zoom the source came out 609 px wide and the pipeline then
  // upscaled it to 696, quietly shipping a blurred label. The export must not
  // depend on what the preview happens to be zoomed to.
  const { domToCanvas } = await import('modern-screenshot')
  const source = await domToCanvas(element, {
    width: element.offsetWidth,
    height: element.offsetHeight,
    scale: target.renderScale,
    backgroundColor: '#ffffff',
    // Cancel any ancestor transform for the same reason.
    style: { transform: 'none', transformOrigin: 'top left' },
    // Editing chrome must never reach a printed label.
    filter: (node) => !(node instanceof HTMLElement) || node.dataset.export !== 'false',
    // Fonts are same-origin, so modern-screenshot can inline them; without that
    // the SVG re-lays-out with a fallback stack and lines wrap differently than
    // the preview showed.
    fetch: { requestInit: { cache: 'force-cache' } },
  })

  const out = document.createElement('canvas')
  out.width = target.width
  out.height = target.height
  const ctx = out.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Could not get a 2D canvas context.')

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, target.width, target.height)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  const box = fitBox(source.width, source.height, target.width, target.height)
  // Upscaling here means the render was smaller than the target, which is a bug
  // in the caller, not something to paper over: a soft label is worse than a
  // failed export because it looks like it worked.
  if (box.dw > source.width) {
    throw new Error(
      `Rendered the label at ${source.width} × ${source.height}, which is smaller than the ` +
        `${target.width} × ${target.height} target. Upscaling would blur the print.`,
    )
  }
  ctx.drawImage(source, box.dx, box.dy, box.dw, box.dh)

  const image = ctx.getImageData(0, 0, target.width, target.height)
  threshold(image.data)
  ctx.putImageData(image, 0, 0)

  const bytes = withDensity(await toPngBytes(out), target.dpi)
  return { bytes, width: target.width, height: target.height, image }
}

/**
 * Pack a thresholded raster into a 1-byte-per-dot bitmap (1 = black), the shape
 * the QL raster encoder consumes.
 */
export function toDotBitmap(image: ImageData): { width: number; height: number; data: Uint8Array } {
  const data = new Uint8Array(image.width * image.height)
  for (let i = 0, p = 0; i < image.data.length; i += 4, p++) {
    data[p] = image.data[i]! < 128 ? 1 : 0
  }
  return { width: image.width, height: image.height, data }
}
