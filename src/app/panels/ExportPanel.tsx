import { useState, type RefObject } from 'react'
import type { Doc } from '../../doc/schema'
import { useDocStore } from '../../doc/store'
import { LABEL_TARGETS, rasterizeLabel, toDotBitmap } from '../../export/raster'
import { labelPdf } from '../../export/pdfRaster'
import { download, stem } from '../../export/download'
import { PRINT_CHECKLIST, printDocument } from '../../export/print'
import { readDensity } from '../../export/png'
import type { OverflowReport } from '../../overflow/probe'
import { PrinterCard } from './PrinterCard'

type Busy = null | 'png300' | 'png600' | 'pdf' | 'print'

export function ExportPanel({
  doc,
  printRoot,
  blocked,
  report,
}: {
  doc: Doc
  printRoot: RefObject<HTMLElement | null>
  blocked: boolean
  report: OverflowReport
}) {
  const template = useDocStore((s) => s.template)
  const [busy, setBusy] = useState<Busy>(null)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [override, setOverride] = useState(false)

  const stopped = blocked && !override
  const isLabel = template === 'label'
  const name = stem(doc.meta.orgShort || doc.meta.org, template, doc.meta.revision)

  const labelElement = () =>
    printRoot.current?.querySelector<HTMLElement>('.doc-page') ??
    (() => {
      throw new Error('The label is not rendered yet.')
    })()

  const run = async (kind: Busy, fn: () => Promise<void>) => {
    setBusy(kind)
    setError(null)
    setNote(null)
    try {
      await fn()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  const exportPng = (dpi: 300 | 600) =>
    run(dpi === 300 ? 'png300' : 'png600', async () => {
      const target = LABEL_TARGETS[dpi]
      const { bytes, width, height } = await rasterizeLabel(labelElement(), target)
      const density = readDensity(bytes)
      download(bytes, `${name}_${width}x${height}_${dpi}dpi.png`, 'image/png')
      setNote(
        `${width} × ${height} px, 1-bit, tagged ${density?.x ?? '?'} px/m (${dpi} dpi). ` +
          'P-touch Editor places this at label size with no scaling.',
      )
    })

  const exportPdf = () =>
    run('pdf', async () => {
      const { bytes } = await rasterizeLabel(labelElement(), LABEL_TARGETS[600])
      const pdf = await labelPdf(bytes, `${doc.meta.title} — ${doc.meta.org}`)
      download(pdf, `${name}_62x100mm.pdf`, 'application/pdf')
      setNote('One page at exactly 62 × 100 mm, independent of any print-dialog setting.')
    })

  const doPrint = () =>
    run('print', async () => {
      const root = printRoot.current
      if (!root) throw new Error('Nothing to print yet.')
      await printDocument(root)
    })

  return (
    <div className="panel">
      {blocked ? (
        <div className="notice notice--bad">
          <strong>Content is overflowing</strong>
          Anything past the page edge is cut off, not wrapped, and the bottom-pinned block goes
          first. Fix it in the Content panel, or export anyway if you know what you are doing.
          <label className="checkbox" style={{ marginTop: '0.4rem' }}>
            <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} />
            <span>Export anyway</span>
          </label>
        </div>
      ) : report.fallback.length > 0 ? (
        <div className="notice">
          <strong>Fits now, but not with fallback fonts</strong>
          The bundled fonts are served from this site, so this only bites somewhere they cannot
          load. Worth a look before you email the file to anyone.
        </div>
      ) : null}

      {isLabel ? (
        <>
          <section>
            <h2>Print over USB</h2>
            <PrinterCard
              disabled={stopped}
              renderBitmap={async () => {
                const { image, width, height } = await rasterizeLabel(
                  labelElement(),
                  LABEL_TARGETS[300],
                )
                void width
                void height
                return toDotBitmap(image)
              }}
            />
          </section>

          <section>
            <h2>Raster export</h2>
            <p>
              P-touch Editor ignores PDF page geometry and drops a PDF in as a small floating image.
              A PNG at exact pixel dimensions, tagged with its physical density, imports 1:1 — that
              is what these are for.
            </p>
            <div className="row">
              <button
                type="button"
                className="btn btn--primary"
                disabled={stopped || busy != null}
                onClick={() => exportPng(300)}
              >
                {busy === 'png300' ? 'Rendering…' : 'PNG · 300 dpi'}
              </button>
              <button
                type="button"
                className="btn"
                disabled={stopped || busy != null}
                onClick={() => exportPng(600)}
              >
                {busy === 'png600' ? 'Rendering…' : 'PNG · 600 dpi'}
              </button>
            </div>
            <p className="field__hint">
              300 dpi is 696 × 1109 px — the QL-500's native printable grid for 62 mm media (58.9 mm
              of the 62 mm is printable). 600 dpi is the fallback for when P-touch downscales; halve
              the placed size by hand.
            </p>
          </section>

          <section>
            <h2>PDF</h2>
            <button
              type="button"
              className="btn"
              disabled={stopped || busy != null}
              onClick={exportPdf}
            >
              {busy === 'pdf' ? 'Building…' : 'PDF · exactly 62 × 100 mm'}
            </button>
            <p className="field__hint">
              Wraps the 600 dpi raster in a one-page PDF whose page box is set in points, so the
              geometry does not depend on what the print dialog is set to. The label is going to a
              1-bit thermal head either way.
            </p>
          </section>
        </>
      ) : null}

      <section>
        <h2>Print to PDF</h2>
        <button
          type="button"
          className={isLabel ? 'btn' : 'btn btn--primary'}
          disabled={stopped || busy != null}
          onClick={doPrint}
        >
          {busy === 'print' ? 'Preparing…' : 'Open the print dialog'}
        </button>
        <p className="field__hint">Keeps live text. Settings that matter:</p>
        <ul style={{ margin: '0.3rem 0 0', paddingLeft: '1.1rem', fontSize: '0.78rem', lineHeight: 1.5, color: 'var(--muted)' }}>
          {PRINT_CHECKLIST[template].map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      {note ? <div className="notice notice--info">{note}</div> : null}
      {error ? (
        <div className="notice notice--bad">
          <strong>Export failed</strong>
          {error}
        </div>
      ) : null}
    </div>
  )
}
