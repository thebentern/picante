import { describe, expect, it } from 'vitest'
import { crc32, pixelsPerMetre, readDensity, withDensity } from '../../src/export/png'

/**
 * Physical density is what makes a 300 dpi PNG import into P-touch Editor at
 * label size instead of as a small floating image the user has to rescale by
 * hand. Canvas.toBlob writes no pHYs chunk at all, so the app splices one in;
 * these pin the bytes.
 */

/** A 1x1 PNG with no pHYs chunk, as canvas.toBlob would produce. */
const MINIMAL_PNG = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmM' +
      'IQAAAABJRU5ErkJggg==',
  ),
  (c) => c.charCodeAt(0),
)

describe('pHYs density', () => {
  it('converts dpi to pixels per metre', () => {
    expect(pixelsPerMetre(300)).toBe(11811)
    expect(pixelsPerMetre(600)).toBe(23622)
  })

  it('computes CRC32 the way PNG does', () => {
    // "IEND" chunk CRC is a fixed, well-known value.
    expect(crc32(new TextEncoder().encode('IEND'))).toBe(0xae426082)
  })

  it('has no density before, and the right density after', () => {
    expect(readDensity(MINIMAL_PNG)).toBeNull()
    expect(readDensity(withDensity(MINIMAL_PNG, 300))).toEqual({ x: 11811, y: 11811, unit: 1 })
    expect(readDensity(withDensity(MINIMAL_PNG, 600))).toEqual({ x: 23622, y: 23622, unit: 1 })
  })

  it('replaces an existing density rather than writing two', () => {
    const once = withDensity(MINIMAL_PNG, 300)
    const twice = withDensity(once, 600)
    expect(readDensity(twice)).toEqual({ x: 23622, y: 23622, unit: 1 })
    // Exactly one pHYs chunk in the file.
    const text = new TextDecoder('latin1').decode(twice)
    expect(text.split('pHYs').length - 1).toBe(1)
    expect(twice.length).toBe(once.length)
  })

  it('puts pHYs immediately after IHDR, where the spec requires it', () => {
    const out = withDensity(MINIMAL_PNG, 300)
    const text = new TextDecoder('latin1').decode(out)
    expect(text.indexOf('pHYs')).toBeGreaterThan(text.indexOf('IHDR'))
    expect(text.indexOf('pHYs')).toBeLessThan(text.indexOf('IDAT'))
  })

  it('refuses anything that is not a PNG', () => {
    expect(() => withDensity(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9]), 300)).toThrow(/not a png/i)
  })
})
