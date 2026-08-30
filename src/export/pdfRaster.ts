import { LABEL_MM, PT_PER_MM } from '../templates/tokens'

/**
 * Wrap a raster in a one-page PDF at an exact physical size.
 *
 * The app is hosted statically, so there is no headless browser to print with
 * deterministic geometry. Print-to-PDF works, but the page size that comes out
 * depends on what the user picks in the print dialog — and "one page at exactly
 * 62 x 100 mm" is an acceptance criterion, not a suggestion. Wrapping the 600
 * dpi raster in a PDF whose page box is set in points guarantees it regardless
 * of the dialog.
 *
 * For the label this loses nothing: the output is going to a 1-bit thermal head
 * that will rasterize it anyway. For the fold card this is offered as a fallback
 * only — print-to-PDF keeps live text there, which matters on an office laser
 * printer.
 */
export async function rasterToPdf(
  png: Uint8Array,
  widthMm: number,
  heightMm: number,
  title: string,
): Promise<Uint8Array> {
  // pdf-lib is a few hundred kilobytes and only this one export needs it, so it
  // loads when someone asks for a PDF rather than on first paint.
  const { PDFDocument } = await import('pdf-lib')
  const pdf = await PDFDocument.create()
  pdf.setTitle(title)
  pdf.setProducer('picante')
  pdf.setCreator('picante')

  const widthPt = widthMm * PT_PER_MM
  const heightPt = heightMm * PT_PER_MM

  const page = pdf.addPage([widthPt, heightPt])
  const image = await pdf.embedPng(png)

  // The raster is a fit-and-centre of the design into the printable box, so it
  // is drawn to fill the page: its own white margins already encode the inset.
  page.drawImage(image, { x: 0, y: 0, width: widthPt, height: heightPt })

  // No object streams: the page geometry stays greppable in the file, which is
  // what the geometry test asserts against and what a stubborn PDF reader wants.
  return pdf.save({ useObjectStreams: false })
}

export const labelPdf = (png: Uint8Array, title: string) =>
  rasterToPdf(png, LABEL_MM.width, LABEL_MM.height, title)

/** Page box in points, for the tests that assert exact geometry. */
export const LABEL_PAGE_PT = {
  width: LABEL_MM.width * PT_PER_MM,
  height: LABEL_MM.height * PT_PER_MM,
}
