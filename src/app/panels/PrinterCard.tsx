import { useState } from 'react'
import { usePrinter } from '../../print/usePrinter'
import { QL_MEDIA, describeStatus, type LabelBitmap, type QlMediaId } from '../../print/qlProtocol'
import { hasPrinterDiag, printerDiagText } from '../../print/diagnostics'

/**
 * Print straight to a Brother QL over WebUSB.
 *
 * The PNG export is good, but it still ends with "now open P-touch Editor,
 * import this, and hope it does not rescale". This path sends the raster to the
 * print head directly — the same thresholded 696 × 1109 dots the PNG contains,
 * which is exactly the QL-500's printable grid for 62 mm media.
 */
export function PrinterCard({
  disabled,
  renderBitmap,
}: {
  disabled: boolean
  renderBitmap: () => Promise<LabelBitmap>
}) {
  const { state, connect, disconnect, refreshStatus, print } = usePrinter()
  const [mediaId, setMediaId] = useState<QlMediaId>('die-cut-62x100')
  const [copies, setCopies] = useState(1)
  const [rendering, setRendering] = useState(false)
  const [copied, setCopied] = useState(false)

  if (!state.supported) {
    return (
      <div className="notice">
        <strong>WebUSB is not available in this browser</strong>
        Direct printing needs Chrome or Edge over HTTPS. Everywhere else, use the PNG export below
        and import it in P-touch Editor — the output is identical.
      </div>
    )
  }

  const busy = state.phase === 'connecting' || state.phase === 'printing' || rendering

  const doPrint = async () => {
    setRendering(true)
    try {
      const bitmap = await renderBitmap()
      await print(bitmap, mediaId, copies)
    } finally {
      setRendering(false)
    }
  }

  return (
    <div className="card">
      {state.phase === 'idle' || !state.name ? (
        <>
          <p style={{ marginBottom: '0.5rem' }}>
            Plug the printer in over USB and connect. Your browser will ask which device to allow —
            nothing is sent anywhere else.
          </p>
          <button type="button" className="btn btn--primary" onClick={connect} disabled={busy}>
            {state.phase === 'connecting' ? 'Connecting…' : 'Connect a Brother QL'}
          </button>
        </>
      ) : (
        <>
          <div className="card__head">
            <span className="card__title">{state.name}</span>
            <button type="button" className="btn btn--ghost btn--small" onClick={disconnect}>
              Disconnect
            </button>
          </div>

          <div style={{ fontSize: '0.78rem', color: 'var(--muted)', lineHeight: 1.5 }}>
            {state.canReadStatus ? (
              <>
                Loaded media: {state.status ? describeStatus(state.status) : 'not reported'}{' '}
                <button
                  type="button"
                  className="btn btn--ghost btn--small"
                  onClick={refreshStatus}
                  disabled={busy}
                >
                  Re-check
                </button>
              </>
            ) : (
              // QL-500-era printers have no bulk IN endpoint at all. Saying so is
              // better than showing a permanently blank media readout.
              <>
                This model cannot report what is loaded — the QL-500 and QL-550 are write-only over
                USB. Check the roll yourself before printing.
              </>
            )}
          </div>

          <div className="row" style={{ marginTop: '0.6rem' }}>
            <label className="grow">
              <span className="field__label">Media</span>
              <select
                value={mediaId}
                onChange={(e) => setMediaId(e.target.value as QlMediaId)}
                              >
                {Object.values(QL_MEDIA).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ width: '5rem' }}>
              <span className="field__label">Copies</span>
              <input
                type="number"
                min={1}
                max={50}
                value={copies}
                onChange={(e) => setCopies(Math.min(50, Math.max(1, Number(e.target.value) || 1)))}
                              />
            </label>
          </div>
          <div className="field__hint">
            62 mm is the widest media a QL-500 takes, and the only width this design fits.
          </div>

          <button
            type="button"
            className="btn btn--primary"
            style={{ marginTop: '0.6rem' }}
            onClick={doPrint}
            disabled={disabled || busy}
          >
            {rendering
              ? 'Rendering…'
              : state.phase === 'printing'
                ? `Printing… ${Math.round(state.progress * 100)}%`
                : `Print ${copies > 1 ? `${copies} labels` : 'label'}`}
          </button>
        </>
      )}

      {state.error ? (
        <div className="notice notice--bad" style={{ marginTop: '0.6rem' }}>
          <strong>Printer error</strong>
          {state.error}
        </div>
      ) : null}

      {hasPrinterDiag() ? (
        <button
          type="button"
          className="btn btn--ghost btn--small"
          style={{ marginTop: '0.5rem' }}
          onClick={async () => {
            await navigator.clipboard.writeText(printerDiagText())
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          }}
        >
          {copied ? 'Copied' : 'Copy diagnostics'}
        </button>
      ) : null}
    </div>
  )
}
