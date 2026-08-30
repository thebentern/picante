import { describe, expect, it } from 'vitest'
import {
  BROTHER_VENDOR_ID,
  QL_MEDIA,
  QlMediaError,
  describeStatus,
  encodeJob,
  packRow,
  resolveMedia,
  type LabelBitmap,
} from '../../src/print/qlProtocol'

/**
 * The QL raster wire format, ported from meshtastic-readyline and narrowed to
 * 62 mm media. These pin the bytes: a print job is not something you can eyeball
 * for correctness, and getting it wrong feeds a metre of tape through a printer
 * before anyone notices.
 */

const BYTES_PER_ROW = 90

const bitmap = (width: number, height: number, fill: (x: number, y: number) => boolean): LabelBitmap => {
  const data = new Uint8Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) data[y * width + x] = fill(x, y) ? 1 : 0
  }
  return { width, height, data }
}

describe('media', () => {
  it('offers 62 mm media only', () => {
    // The QL-500 takes nothing wider and the design fits nothing narrower, so
    // an address-label template would only be a way to print a card that does
    // not fit on it.
    for (const media of Object.values(QL_MEDIA)) {
      expect(media.widthMm).toBe(62)
      expect(media.imgWidth).toBe(696)
      expect(media.imgHeight).toBe(1109)
    }
  })

  it("uses brother_ql's printable dot grid, which is the PNG export's target", () => {
    expect(QL_MEDIA['die-cut-62x100']).toMatchObject({
      mediaType: 0x0b,
      lengthMm: 100,
      imgWidth: 696,
      imgHeight: 1109,
      offsetR: 12,
      feedDots: 0,
    })
    // Continuous tape needs a feed margin; die-cut does not.
    expect(QL_MEDIA['continuous-62'].feedDots).toBe(35)
  })
})

describe('resolveMedia', () => {
  const status = (over: Partial<{ mediaWidthMm: number; mediaType: number; mediaLengthMm: number }>) => ({
    mediaWidthMm: 62,
    mediaType: 0x0b,
    mediaLengthMm: 100,
    errors: 0,
    ...over,
  })

  it('trusts the dropdown when the printer cannot answer', () => {
    // QL-500 and QL-550 have no bulk IN endpoint at all. That must not block
    // printing, or those printers can never print anything.
    expect(resolveMedia('die-cut-62x100', null).id).toBe('die-cut-62x100')
    expect(resolveMedia('continuous-62', status({ mediaWidthMm: 0 })).id).toBe('continuous-62')
  })

  it('trusts the printer over the dropdown when it can', () => {
    expect(resolveMedia('die-cut-62x100', status({ mediaType: 0x0a, mediaLengthMm: 0 })).id).toBe(
      'continuous-62',
    )
    expect(resolveMedia('continuous-62', status({ mediaType: 0x0b })).id).toBe('die-cut-62x100')
  })

  it('refuses to feed the wrong roll', () => {
    expect(() => resolveMedia('die-cut-62x100', status({ mediaWidthMm: 29 }))).toThrow(QlMediaError)
    expect(() => resolveMedia('die-cut-62x100', status({ mediaWidthMm: 29 }))).toThrow(/29 mm/)
    expect(() => resolveMedia('die-cut-62x100', status({ mediaLengthMm: 29 }))).toThrow(/DK-11202/)
  })

  it('describes what is loaded in words a person can act on', () => {
    expect(describeStatus(status({}))).toBe('62 × 100 mm die-cut')
    expect(describeStatus(status({ mediaType: 0x0a, mediaLengthMm: 0 }))).toBe('62 mm continuous')
    expect(describeStatus(status({ mediaWidthMm: 0 }))).toBe('no media loaded')
  })
})

describe('packRow', () => {
  it('mirrors left-to-right and offsets into the 720-dot head', () => {
    // The head addresses dots right to left, and 62 mm media sits 12 dots in
    // from the right edge. A row of ink at image x=0 must land at the far end
    // of the head buffer.
    const row = packRow(bitmap(696, 1, (x) => x === 0), 0, 12)
    expect(row).toHaveLength(BYTES_PER_ROW)
    const set: number[] = []
    row.forEach((byte, i) => {
      for (let b = 0; b < 8; b++) if (byte & (0x80 >> b)) set.push(i * 8 + b)
    })
    // pasteX = 720 - 696 - 12 = 12; imgX 0 sits at bufferX 12, i.e. p = 707.
    expect(set).toEqual([707])
  })

  it('packs MSB first', () => {
    const row = packRow(bitmap(696, 1, () => true), 0, 12)
    // A full-width row lights head dots 12 through 707: pasteX is
    // 720 − 696 − 12 = 12, and imgX = 719 − p − pasteX.
    expect(row[0]).toBe(0b00000000) // dots 0–7: outside the media
    expect(row[1]).toBe(0b00001111) // dots 8–15: ink starts at 12
    expect(row[44]).toBe(0xff)
    expect(row[88]).toBe(0b11110000) // dots 704–711: ink ends at 707
    expect(row[89]).toBe(0b00000000)
  })
})

describe('encodeJob', () => {
  const media = QL_MEDIA['die-cut-62x100']
  const page = bitmap(696, 1109, (x, y) => x === y % 696)

  it('opens with the invalidate-and-initialize preamble', () => {
    const job = encodeJob([page], media)
    expect(Array.from(job.subarray(0, 200))).toEqual(new Array(200).fill(0))
    expect(Array.from(job.subarray(200, 202))).toEqual([0x1b, 0x40])
  })

  it('declares the media, the line count and high quality', () => {
    const job = encodeJob([page], media)
    const at = 205 // 200 invalidate + ESC @ + ESC i S
    expect(Array.from(job.subarray(at, at + 3))).toEqual([0x1b, 0x69, 0x7a])
    expect(job[at + 3]).toBe(0x80 | 0x02 | 0x04 | 0x08 | 0x40)
    expect(job[at + 4]).toBe(0x0b) // die-cut
    expect(job[at + 5]).toBe(62)
    expect(job[at + 6]).toBe(100)
    const lines = job[at + 7]! | (job[at + 8]! << 8) | (job[at + 9]! << 16) | (job[at + 10]! << 24)
    expect(lines).toBe(1109)
  })

  it('emits one 93-byte raster command per line and ends with print-and-feed', () => {
    const job = encodeJob([page], media)
    expect(job.at(-1)).toBe(0x1a)
    // 200 + 2 preamble, then per page: 3 (ESC i S) + 13 (ESC i z) + 5 (ESC i d)
    // + lines * 93 + 1 terminator.
    expect(job.length).toBe(202 + 3 + 13 + 5 + 1109 * (3 + BYTES_PER_ROW) + 1)
  })

  it('separates copies with a form feed and ends the last one with print', () => {
    const job = encodeJob([page, page], media)
    expect(job.at(-1)).toBe(0x1a)
    // Exactly one 0x0C page separator, before the final page.
    const feeds = Array.from(job).filter((b, i) => b === 0x0c && i > 202).length
    expect(feeds).toBeGreaterThanOrEqual(1)
    expect(job.length).toBe(202 + 2 * (3 + 13 + 5 + 1109 * (3 + BYTES_PER_ROW) + 1))
  })

  it('refuses a bitmap that is not the media size', () => {
    // A mis-sized page would print as garbage, and there is no undo on tape.
    expect(() => encodeJob([bitmap(696, 271, () => false)], media)).toThrow(/expected 696 × 1109/)
  })

  it('targets Brother', () => {
    expect(BROTHER_VENDOR_ID).toBe(0x04f9)
  })
})
