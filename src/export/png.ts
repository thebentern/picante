/**
 * PNG physical-density metadata.
 *
 * Canvas `toBlob` writes no pHYs chunk, so a canvas-produced PNG carries no
 * physical size at all — and Brother P-touch Editor has nothing to place the
 * image by, which is exactly the "imports as a small floating image" problem the
 * raster export exists to solve. Splicing a pHYs chunk in is what makes a 300
 * dpi label land at label size instead of at whatever the importing app guesses.
 */

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

/** Pixels per metre, which is the only unit pHYs has. */
export const pixelsPerMetre = (dpi: number) => Math.round(dpi / 0.0254)

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length)
  const view = new DataView(out.buffer)
  view.setUint32(0, data.length)
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i)
  out.set(data, 8)
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)))
  return out
}

function physChunk(dpi: number): Uint8Array {
  const data = new Uint8Array(9)
  const view = new DataView(data.buffer)
  const ppm = pixelsPerMetre(dpi)
  view.setUint32(0, ppm) // pixels per unit, X
  view.setUint32(4, ppm) // pixels per unit, Y
  data[8] = 1 // unit specifier: 1 = metre
  return chunk('pHYs', data)
}

function isPng(bytes: Uint8Array): boolean {
  return PNG_SIGNATURE.every((b, i) => bytes[i] === b)
}

/**
 * Insert (or replace) the pHYs chunk. Per the PNG spec pHYs must precede IDAT,
 * and IHDR is always the first chunk, so immediately after IHDR is both legal
 * and unambiguous.
 */
export function withDensity(png: Uint8Array, dpi: number): Uint8Array {
  if (!isPng(png)) throw new Error('Not a PNG: cannot set physical density.')

  const view = new DataView(png.buffer, png.byteOffset, png.byteLength)
  const parts: Uint8Array[] = [png.subarray(0, 8)]
  let offset = 8
  let inserted = false

  while (offset + 8 <= png.length) {
    const length = view.getUint32(offset)
    const type = String.fromCharCode(...png.subarray(offset + 4, offset + 8))
    const end = offset + 12 + length
    if (end > png.length) break

    if (type === 'pHYs') {
      // Drop any existing density and write ours instead.
      offset = end
      continue
    }

    parts.push(png.subarray(offset, end))

    if (type === 'IHDR' && !inserted) {
      parts.push(physChunk(dpi))
      inserted = true
    }
    offset = end
    if (type === 'IEND') break
  }

  if (!inserted) throw new Error('Malformed PNG: no IHDR chunk found.')

  const total = parts.reduce((n, p) => n + p.length, 0)
  const out = new Uint8Array(total)
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}

/** Read the density back — used by the tests and by the export summary. */
export function readDensity(png: Uint8Array): { x: number; y: number; unit: number } | null {
  if (!isPng(png)) return null
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength)
  let offset = 8
  while (offset + 8 <= png.length) {
    const length = view.getUint32(offset)
    const type = String.fromCharCode(...png.subarray(offset + 4, offset + 8))
    if (type === 'pHYs') {
      return {
        x: view.getUint32(offset + 8),
        y: view.getUint32(offset + 12),
        unit: png[offset + 16]!,
      }
    }
    if (type === 'IEND') break
    offset += 12 + length
  }
  return null
}
