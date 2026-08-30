
/**
 * Render a provisioning URL to a QR data URI, client-side. Nothing is uploaded
 * and no QR image ships in this repository.
 *
 * Sized and error-corrected for the worst case in the deck: 16 mm printed at
 * 300 dpi on a 1-bit thermal head. That is ~189 device pixels across, so a
 * version-heavy code with a low module count per pixel stops scanning. Error
 * correction stays at 'M' — 'H' inflates the module count enough to lose more
 * than it protects at this size — and the quiet zone (margin) is kept at the
 * spec-required 4 modules, because thermal printers bleed ink into it.
 */
export async function renderQrDataUrl(url: string, pixels = 1024): Promise<string> {
  const QRCode = (await import('qrcode')).default
  return QRCode.toDataURL(url, {
    errorCorrectionLevel: 'M',
    margin: 4,
    width: pixels,
    color: { dark: '#000000ff', light: '#ffffffff' },
  })
}

/** Module count across, for the "will this scan at 16 mm?" check. */
export async function qrModuleCount(url: string): Promise<number> {
  const QRCode = (await import('qrcode')).default
  // qrcode's create() exposes the symbol's module matrix size.
  const sym = QRCode.create(url, { errorCorrectionLevel: 'M' })
  return sym.modules.size
}

/**
 * A QR only scans reliably when each module lands on enough printed dots.
 * Below ~2.5 dots per module a 300 dpi thermal head smears adjacent modules
 * together, so a code that is fine on the fold card can be unscannable on the
 * label.
 */
export function scanRisk(moduleCount: number, sizeMm: number, dpi: number) {
  const quietZone = 8 // 4 modules on each side
  const dotsPerModule = (sizeMm / 25.4) * dpi / (moduleCount + quietZone)
  return {
    dotsPerModule,
    ok: dotsPerModule >= 2.5,
    moduleCount,
  }
}
