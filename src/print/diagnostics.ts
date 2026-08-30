/**
 * Capture buffer for printer diagnostics.
 *
 * WebUSB fails in a dozen quiet, hardware-shaped ways — a driver holding the
 * interface, a printer with no bulk IN endpoint, the wrong roll loaded. The
 * person hitting those is standing at a printer, not in DevTools, so everything
 * logged here is kept in a ring buffer behind a "Copy diagnostics" button as
 * well as going to the console.
 *
 * Ported from Meshtastic-Solutions/meshtastic-readyline (GPL-3.0).
 */

const MAX_LINES = 1000
const buffer: string[] = []

const stamp = () => new Date().toISOString().slice(11, 23)

function render(part: unknown): string {
  if (typeof part === 'string') return part
  if (part instanceof Error) return formatError(part)
  try {
    return JSON.stringify(part)
  } catch {
    return String(part)
  }
}

/** Format a thrown value with the bits that actually localize a WebUSB failure. */
export function formatError(err: unknown): string {
  if (err instanceof Error || (err && typeof err === 'object' && 'message' in err)) {
    const e = err as { name?: string; message?: string }
    return `${e.name ?? 'Error'}: ${e.message ?? ''}`.trim()
  }
  return String(err)
}

/** Lowercase hex dump of raw bytes (status replies etc.). */
export function hexBytes(bytes: Uint8Array | ArrayBuffer | undefined | null): string {
  if (!bytes) return '(none)'
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join(' ')
}

export function printerDiag(...parts: unknown[]): void {
  const line = `${stamp()} ${parts.map(render).join(' ')}`
  buffer.push(line)
  if (buffer.length > MAX_LINES) buffer.splice(0, buffer.length - MAX_LINES)
  // console.info rather than console.debug: debug is hidden by default.
  console.info('[ql]', ...parts)
}

export const hasPrinterDiag = () => buffer.length > 0
export const resetPrinterDiag = () => void (buffer.length = 0)

/** The full, copy-pasteable report: environment header plus captured lines. */
export function printerDiagText(): string {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'
  const webusb = typeof navigator !== 'undefined' && !!navigator.usb
  return [
    'picante label-printer diagnostics',
    `when:    ${new Date().toISOString()}`,
    `browser: ${ua}`,
    `webusb:  ${webusb ? 'available' : 'NOT available (needs Chrome or Edge over https)'}`,
    `lines:   ${buffer.length}`,
    '--------',
    ...buffer,
  ].join('\n')
}
