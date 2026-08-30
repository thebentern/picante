import { useCallback, useEffect, useRef, useState } from 'react'
import { QlPrinter } from './QlPrinter'
import {
  encodeJob,
  QL_MEDIA,
  QlMediaError,
  resolveMedia,
  type LabelBitmap,
  type QlMediaId,
  type QlStatus,
} from './qlProtocol'
import { formatError, printerDiag } from './diagnostics'

export type PrinterPhase = 'idle' | 'connecting' | 'ready' | 'printing' | 'error'

export interface PrinterState {
  supported: boolean
  phase: PrinterPhase
  name: string | null
  status: QlStatus | null
  canReadStatus: boolean
  progress: number
  error: string | null
}

const INITIAL: PrinterState = {
  supported: QlPrinter.supported(),
  phase: 'idle',
  name: null,
  status: null,
  canReadStatus: false,
  progress: 0,
  error: null,
}

/**
 * Connect to a Brother QL and print the label straight over USB.
 *
 * This exists because the PNG export, good as it is, still asks the user to
 * open P-touch Editor, import a file, and trust it not to rescale. Sending the
 * raster to the print head directly removes every step in between — and the
 * bitmap is the exact same thresholded 696 x 1109 dots the PNG contains, so
 * what prints is what the preview showed.
 */
export function usePrinter() {
  const printer = useRef<QlPrinter | null>(null)
  const [state, setState] = useState<PrinterState>(INITIAL)

  useEffect(() => {
    const owned = printer
    return () => {
      void owned.current?.close()
      owned.current = null
    }
  }, [])

  const connect = useCallback(async () => {
    setState((s) => ({ ...s, phase: 'connecting', error: null }))
    const device = printer.current ?? new QlPrinter()
    printer.current = device
    try {
      await device.connect()
      const status = device.canReadStatus ? await device.readStatus() : null
      setState((s) => ({
        ...s,
        phase: 'ready',
        name: device.name,
        status,
        canReadStatus: device.canReadStatus,
        error: null,
      }))
    } catch (err) {
      // The picker's "user cancelled" rejection is not a failure worth shouting
      // about — it is someone changing their mind.
      const cancelled = err instanceof DOMException && err.name === 'NotFoundError'
      printerDiag('connect failed:', formatError(err))
      setState((s) => ({
        ...s,
        phase: cancelled ? 'idle' : 'error',
        error: cancelled ? null : formatError(err),
      }))
    }
  }, [])

  const disconnect = useCallback(async () => {
    await printer.current?.close()
    printer.current = null
    setState({ ...INITIAL, supported: QlPrinter.supported() })
  }, [])

  const refreshStatus = useCallback(async () => {
    const device = printer.current
    if (!device?.connected) return
    const status = await device.readStatus()
    setState((s) => ({ ...s, status }))
  }, [])

  const print = useCallback(
    async (bitmap: LabelBitmap, mediaId: QlMediaId, copies: number) => {
      const device = printer.current
      if (!device?.connected) {
        setState((s) => ({ ...s, phase: 'error', error: 'Connect to a printer first.' }))
        return
      }
      setState((s) => ({ ...s, phase: 'printing', progress: 0, error: null }))
      try {
        // Re-read status right before printing: the roll can have been swapped
        // since connect, and feeding 100 mm of the wrong tape is not free.
        const status = device.canReadStatus ? await device.readStatus() : null
        const media = resolveMedia(mediaId, status)

        if (bitmap.width !== media.imgWidth || bitmap.height !== media.imgHeight) {
          throw new Error(
            `The rendered label is ${bitmap.width} × ${bitmap.height} dots but ${media.label} ` +
              `needs ${media.imgWidth} × ${media.imgHeight}.`,
          )
        }

        const job = encodeJob(Array.from({ length: copies }, () => bitmap), media)
        await device.print(job, (progress) => setState((s) => ({ ...s, progress })))
        setState((s) => ({ ...s, phase: 'ready', progress: 1, status }))
      } catch (err) {
        printerDiag('print failed:', formatError(err))
        setState((s) => ({
          ...s,
          phase: 'error',
          error: err instanceof QlMediaError ? err.message : formatError(err),
        }))
      }
    },
    [],
  )

  return { state, connect, disconnect, refreshStatus, print, media: QL_MEDIA }
}
