/**
 * Brother QL raster job encoder, scoped to 62 mm media.
 *
 * The byte stream mirrors brother_ql (the reference implementation) for the
 * QL-500 capability set: no compression, no mode switching, no auto-cut, no
 * expanded mode. Ported from Meshtastic-Solutions/meshtastic-readyline
 * (GPL-3.0), narrowed to the widest media the QL-500 takes — this app prints
 * one thing, and it is a 62 mm label.
 *
 * The convenient part: brother_ql's printable dot grid for 62 x 100 mm die-cut
 * media is 696 x 1109, which is byte-for-byte the raster target the PNG export
 * already produces. The same thresholded pixels drive both paths, so what comes
 * out of the printer is what the PNG shows.
 */

export const BROTHER_VENDOR_ID = 0x04f9

/** 720 print-head dots = 90 bytes per raster line on every QL model. */
const HEAD_DOTS = 720
const BYTES_PER_ROW = 90

/** 1-bit page bitmap; data[y * width + x] = 1 means burn this dot. */
export interface LabelBitmap {
  width: number
  height: number
  data: Uint8Array
}

export interface QlMedia {
  id: string
  label: string
  /** 0x0A continuous, 0x0B die-cut */
  mediaType: 0x0a | 0x0b
  widthMm: number
  /** 0 for continuous */
  lengthMm: number
  /** Bitmap dimensions the encoder expects. */
  imgWidth: number
  imgHeight: number
  /** Unprintable dots on the right side of the head. */
  offsetR: number
  /** ESC i d feed amount. */
  feedDots: number
}

/**
 * 62 mm media only.
 *
 * The QL-500 takes nothing wider, and this app has exactly one label design at
 * exactly one size, so offering 29 mm address stock or 23 mm squares would only
 * be offering ways to print a card that does not fit on them.
 */
export const QL_MEDIA = {
  /** DK-11202. The design's native size. */
  'die-cut-62x100': {
    id: 'die-cut-62x100',
    label: 'DK-11202 — 62 × 100 mm die-cut',
    mediaType: 0x0b,
    widthMm: 62,
    lengthMm: 100,
    imgWidth: 696,
    imgHeight: 1109,
    offsetR: 12,
    feedDots: 0,
  },
  /**
   * DK-22205. 62 mm continuous tape, cut to the same 1109-dot length so the
   * printed card is identical — the QL-500 ships with this roll, so a user who
   * has not bought die-cut stock can still print.
   */
  'continuous-62': {
    id: 'continuous-62',
    label: 'DK-22205 — 62 mm continuous',
    mediaType: 0x0a,
    widthMm: 62,
    lengthMm: 0,
    imgWidth: 696,
    imgHeight: 1109,
    offsetR: 12,
    feedDots: 35,
  },
} as const satisfies Record<string, QlMedia>

export type QlMediaId = keyof typeof QL_MEDIA

export interface QlStatus {
  mediaWidthMm: number
  /** 0x0A continuous · 0x0B die-cut · 0 = nothing loaded */
  mediaType: number
  mediaLengthMm: number
  errors: number
}

export class QlMediaError extends Error {}

/**
 * Reconcile the chosen media with what the printer says is loaded.
 *
 * QL-500-era printers have no bulk IN endpoint and cannot answer at all, so a
 * null status is normal and never blocks a print — it just means the user is
 * responsible for having the right roll in the machine.
 */
export function resolveMedia(preferred: QlMediaId, status: QlStatus | null): QlMedia {
  const media = QL_MEDIA[preferred]
  if (!status || status.mediaWidthMm <= 0) return media

  if (status.mediaWidthMm !== 62) {
    throw new QlMediaError(
      `The printer has ${status.mediaWidthMm} mm media loaded. This label needs 62 mm — it is the ` +
        'only width the design fits on.',
    )
  }

  // Trust the printer over the dropdown when it can actually tell us.
  if (status.mediaType === 0x0a && media.mediaType !== 0x0a) return QL_MEDIA['continuous-62']
  if (status.mediaType === 0x0b && media.mediaType !== 0x0b) {
    if (status.mediaLengthMm > 0 && status.mediaLengthMm !== 100) {
      throw new QlMediaError(
        `The loaded die-cut labels are 62 × ${status.mediaLengthMm} mm. This design is 62 × 100 mm ` +
          '(DK-11202) — load that roll, or switch to 62 mm continuous tape.',
      )
    }
    return QL_MEDIA['die-cut-62x100']
  }

  if (media.mediaType === 0x0b && status.mediaLengthMm > 0 && status.mediaLengthMm !== media.lengthMm) {
    throw new QlMediaError(
      `The loaded die-cut labels are 62 × ${status.mediaLengthMm} mm, but this design is ` +
        `62 × ${media.lengthMm} mm. Load DK-11202, or switch to 62 mm continuous tape.`,
    )
  }

  return media
}

/**
 * Pack one bitmap row into the 90-byte head buffer.
 *
 * brother_ql equivalent: paste the image into a 720-wide white canvas at
 * x = 720 - imgWidth - offsetR, mirror left/right (the head addresses dots
 * right-to-left), pack MSB-first.
 */
export function packRow(bitmap: LabelBitmap, y: number, offsetR: number): Uint8Array {
  const out = new Uint8Array(BYTES_PER_ROW)
  const pasteX = HEAD_DOTS - bitmap.width - offsetR
  const rowBase = y * bitmap.width
  for (let p = 0; p < HEAD_DOTS; p++) {
    const bufferX = HEAD_DOTS - 1 - p // mirror
    const imgX = bufferX - pasteX
    if (imgX < 0 || imgX >= bitmap.width) continue
    if (bitmap.data[rowBase + imgX]) out[p >> 3]! |= 0x80 >> (p & 7)
  }
  return out
}

/** Full print job for one or more copies of the same label. */
export function encodeJob(pages: LabelBitmap[], media: QlMedia, highQuality = true): Uint8Array {
  const parts: Uint8Array[] = []
  const push = (...bytes: number[]) => parts.push(Uint8Array.from(bytes))

  parts.push(new Uint8Array(200)) // invalidate
  push(0x1b, 0x40) // initialize

  pages.forEach((page, index) => {
    if (page.width !== media.imgWidth || page.height !== media.imgHeight) {
      throw new Error(
        `Page ${index}: expected ${media.imgWidth} × ${media.imgHeight} dots, got ` +
          `${page.width} × ${page.height}.`,
      )
    }

    push(0x1b, 0x69, 0x53) // status information request

    // ESC i z — media & quality. Flags: 0x80 | type | width | length | quality.
    const flags = 0x80 | 0x02 | 0x04 | 0x08 | (highQuality ? 0x40 : 0x00)
    const lines = page.height
    push(
      0x1b, 0x69, 0x7a,
      flags, media.mediaType, media.widthMm, media.lengthMm,
      lines & 0xff, (lines >> 8) & 0xff, (lines >> 16) & 0xff, (lines >> 24) & 0xff,
      index === 0 ? 0 : 1, 0x00,
    )

    push(0x1b, 0x69, 0x64, media.feedDots & 0xff, (media.feedDots >> 8) & 0xff) // margins

    const raster = new Uint8Array(lines * (3 + BYTES_PER_ROW))
    let offset = 0
    for (let y = 0; y < lines; y++) {
      raster[offset++] = 0x67 // 'g' — raster line
      raster[offset++] = 0x00
      raster[offset++] = BYTES_PER_ROW
      raster.set(packRow(page, y, media.offsetR), offset)
      offset += BYTES_PER_ROW
    }
    parts.push(raster)

    push(index === pages.length - 1 ? 0x1a : 0x0c) // print (+ feed on the last page)
  })

  const total = parts.reduce((n, part) => n + part.length, 0)
  const job = new Uint8Array(total)
  let cursor = 0
  for (const part of parts) {
    job.set(part, cursor)
    cursor += part.length
  }
  return job
}

export const describeStatus = (s: QlStatus): string => {
  if (s.mediaWidthMm === 0) return 'no media loaded'
  const kind = s.mediaType === 0x0b ? 'die-cut' : s.mediaType === 0x0a ? 'continuous' : 'unknown'
  const size = s.mediaLengthMm > 0 ? `${s.mediaWidthMm} × ${s.mediaLengthMm} mm` : `${s.mediaWidthMm} mm`
  return `${size} ${kind}`
}
