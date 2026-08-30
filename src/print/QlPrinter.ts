import { BROTHER_VENDOR_ID, type QlStatus } from './qlProtocol'
import { formatError, hexBytes, printerDiag } from './diagnostics'

/**
 * A Brother QL over WebUSB.
 *
 * Ported from Meshtastic-Solutions/meshtastic-readyline (GPL-3.0).
 *
 * WebUSB needs a secure context and a user gesture, both of which this app has:
 * GitHub Pages is HTTPS and connect() is called straight from a button. It is
 * Chrome and Edge only; Safari and Firefox have no WebUSB, so the UI checks
 * `supported()` and falls back to the PNG export rather than offering a button
 * that cannot work.
 */

/** Known Brother QL product ids, for friendlier messages. */
const KNOWN_MODELS: Record<number, string> = {
  0x2015: 'QL-500',
  0x2016: 'QL-550',
  0x2027: 'QL-560',
  0x2028: 'QL-570',
  0x2029: 'QL-580N',
  0x201b: 'QL-650TD',
  0x2042: 'QL-700',
  0x2043: 'QL-710W',
  0x2044: 'QL-720NW',
  0x209b: 'QL-800',
  0x209c: 'QL-810W',
  0x209d: 'QL-820NWB',
  0x2020: 'QL-1050',
  0x202a: 'QL-1060N',
}

export class QlPrinter {
  private device: USBDevice | null = null
  private interfaceNumber = 0
  private endpointOut = 0
  private endpointIn = 0
  private inPacketSize = 64

  /** True once connect() found a bulk IN endpoint to read status from. */
  canReadStatus = false

  static supported(): boolean {
    return typeof navigator !== 'undefined' && !!navigator.usb
  }

  get connected(): boolean {
    return this.device != null
  }

  get name(): string {
    if (!this.device) return 'printer'
    return (
      KNOWN_MODELS[this.device.productId] ??
      this.device.productName ??
      `Brother 0x${this.device.productId.toString(16)}`
    )
  }

  /** Must be called from a user gesture — Chrome shows the device picker. */
  async connect(): Promise<void> {
    if (!navigator.usb) {
      printerDiag('connect: WebUSB unavailable (navigator.usb missing)')
      throw new Error('WebUSB is not available in this browser. Use Chrome or Edge.')
    }
    printerDiag('connect: requesting device picker…')
    const device = await navigator.usb.requestDevice({
      filters: [{ vendorId: BROTHER_VENDOR_ID }],
    })
    await device.open()
    if (!device.configuration) {
      await device.selectConfiguration(device.configurations[0]?.configurationValue ?? 1)
    }

    // Prefer the USB printer-class interface (0x07); fall back to the first.
    const interfaces = device.configuration?.interfaces ?? []
    const printerInterface =
      interfaces.find((i) => i.alternates[0]?.interfaceClass === 0x07) ?? interfaces[0]
    if (!printerInterface) {
      await device.close()
      throw new Error('That device has no claimable interface.')
    }
    await device.claimInterface(printerInterface.interfaceNumber)

    const endpoints = printerInterface.alternates[0]?.endpoints ?? []
    printerDiag(
      'interface', printerInterface.interfaceNumber,
      'class', printerInterface.alternates[0]?.interfaceClass,
      'endpoints:',
      endpoints.map((e) => `${e.direction}/${e.type}#${e.endpointNumber}@${e.packetSize}`).join(', ') ||
        '(none)',
    )

    const out = endpoints.find((e) => e.direction === 'out' && e.type === 'bulk')
    const input = endpoints.find((e) => e.direction === 'in' && e.type === 'bulk')
    if (!out) {
      await device.close()
      throw new Error('That device has no bulk OUT endpoint — it is not a QL printer.')
    }

    this.device = device
    this.interfaceNumber = printerInterface.interfaceNumber
    this.endpointOut = out.endpointNumber
    this.endpointIn = input?.endpointNumber ?? 0
    this.inPacketSize = input?.packetSize ?? 64
    this.canReadStatus = !!input

    if (!input) {
      // QL-500/550-era printers are write-only over USB. Not an error: it just
      // means we cannot verify the loaded roll before feeding tape.
      printerDiag(
        'connect: no bulk IN endpoint — this printer cannot report loaded media; printing proceeds ' +
          'without validation',
      )
    }
    printerDiag('connected:', this.name, `out#${this.endpointOut}`, `canReadStatus=${this.canReadStatus}`)
  }

  /**
   * Ask the printer what is loaded: reset (invalidate + init), request status
   * (ESC i S), read one status frame from the bulk IN endpoint.
   *
   * Returns null whenever the printer cannot or will not answer. Callers treat
   * status as advisory and never block a print on it — a QL-500 has no IN
   * endpoint at all and would otherwise be unable to print anything.
   */
  async readStatus(timeoutMs = 2500): Promise<QlStatus | null> {
    if (!this.device || !this.endpointIn) {
      printerDiag('readStatus: no bulk IN endpoint — status read-back unsupported on this printer')
      return null
    }
    try {
      const init = new Uint8Array(202) // 200 nulls (invalidate) + ESC @ (init)
      init[200] = 0x1b
      init[201] = 0x40
      await this.device.transferOut(this.endpointOut, init)
      await this.device.transferOut(this.endpointOut, Uint8Array.from([0x1b, 0x69, 0x53])) // ESC i S

      // The firmware finishes its reset before it can service the status
      // request; without this pause the first several reads are zero-length.
      await sleep(100)

      // Request a whole max-size packet, not 32 — a short read against a
      // 64-byte endpoint can babble-reject on some platforms.
      const readLen = Math.max(64, this.inPacketSize)
      const deadline = Date.now() + timeoutMs
      let data: DataView | undefined

      while (Date.now() < deadline) {
        const read = this.device.transferIn(this.endpointIn, readLen)
        read.catch(() => {})
        const result = await Promise.race([
          read,
          sleep(deadline - Date.now()).then(() => null),
        ])

        if (!result) break
        if (result.status !== 'ok') {
          printerDiag('readStatus: transfer error', result.status)
          return null
        }
        if ((result.data?.byteLength ?? 0) === 0) {
          printerDiag('readStatus: zero-length packet — waiting for the printer to be ready')
          await sleep(30)
          continue
        }
        data = result.data
        break
      }

      if (!data) {
        printerDiag(`readStatus: timed out after ${timeoutMs}ms`)
        return null
      }
      if (data.byteLength < 20) {
        printerDiag('readStatus: short response,', data.byteLength, 'bytes')
        return null
      }

      const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
      printerDiag('status frame:', hexBytes(bytes))
      if (bytes[0] !== 0x80) {
        printerDiag(`readStatus: unexpected header 0x${bytes[0]!.toString(16)} (expected 0x80)`)
        return null
      }

      const status: QlStatus = {
        errors: (bytes[8]! << 8) | bytes[9]!,
        mediaWidthMm: bytes[10]!,
        mediaType: bytes[11]!,
        mediaLengthMm: bytes[17]!,
      }
      printerDiag(
        'media:', `${status.mediaWidthMm}mm`,
        'type 0x' + status.mediaType.toString(16),
        'len', `${status.mediaLengthMm}mm`,
        'errors 0x' + status.errors.toString(16),
      )
      return status
    } catch (err) {
      printerDiag('readStatus error:', formatError(err))
      return null
    }
  }

  /** Stream a raster job to the printer in chunks, reporting 0..1 progress. */
  async print(job: Uint8Array, onProgress?: (fraction: number) => void): Promise<void> {
    if (!this.device) throw new Error('Not connected to a printer.')
    printerDiag('print:', job.length, 'bytes to', this.name)
    const CHUNK = 16 * 1024
    for (let sent = 0; sent < job.length; sent += CHUNK) {
      const chunk = job.subarray(sent, Math.min(sent + CHUNK, job.length))
      const result = await this.device.transferOut(this.endpointOut, chunk)
      if (result.status !== 'ok') {
        printerDiag(`print: transfer failed (${result.status}) at byte ${sent}/${job.length}`)
        throw new Error(`USB transfer failed (${result.status}).`)
      }
      onProgress?.(Math.min(1, (sent + chunk.length) / job.length))
    }
    printerDiag('print: done')
  }

  async close(): Promise<void> {
    if (!this.device) return
    try {
      await this.device.releaseInterface(this.interfaceNumber)
    } catch {
      /* best effort */
    }
    try {
      await this.device.close()
    } catch {
      /* already gone */
    }
    this.device = null
    this.canReadStatus = false
    printerDiag('closed')
  }
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, Math.max(0, ms)))
