/**
 * Print-to-PDF.
 *
 * Page geometry is already owned by <Page>, which injects the @page rule and
 * the print-only CSS that hides the app chrome. This module's job is the timing
 * around window.print(): make sure fonts, QR images and map tiles have actually
 * painted before the print snapshot is taken, because anything still loading
 * prints blank.
 */

async function waitForImages(root: HTMLElement, timeoutMs: number): Promise<void> {
  const images = Array.from(root.querySelectorAll('img'))
  await Promise.race([
    Promise.all(
      images.map((img) =>
        img.complete && img.naturalWidth > 0
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              img.addEventListener('load', () => resolve(), { once: true })
              img.addEventListener('error', () => resolve(), { once: true })
            }),
      ),
    ),
    sleep(timeoutMs),
  ])
}

async function waitForMaps(root: HTMLElement, timeoutMs: number): Promise<void> {
  const maps = Array.from(root.querySelectorAll<HTMLElement>('[data-map]'))
  if (maps.length === 0) return
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (maps.every((m) => m.dataset.mapReady === 'true')) return
    await sleep(120)
  }
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export async function printDocument(root: HTMLElement): Promise<void> {
  await document.fonts?.ready.catch(() => {})
  await waitForImages(root, 5000)
  await waitForMaps(root, 8000)
  // One more frame so the browser has committed the last layout.
  await new Promise<void>((r) => requestAnimationFrame(() => r()))
  window.print()
}

/**
 * The print dialog settings that matter. @page { margin: 0 } already denies
 * Chrome room to draw its own header, and print-color-adjust is set globally,
 * but paper and scale are the user's to pick and getting them wrong silently
 * resizes the card.
 */
export const PRINT_CHECKLIST: Record<'fold' | 'label' | 'plan', string[]> = {
  fold: [
    'Destination — Save as PDF (or your printer)',
    'Paper size — Letter',
    'Margins — None',
    'Scale — 100%, not "Fit to page"',
    'Background graphics — on, or the tier colours drop out',
  ],
  label: [
    'Destination — Save as PDF',
    'Paper size — a custom 62 × 100 mm, if your dialog offers one',
    'Margins — None',
    'Scale — 100%',
    'Background graphics — on, or the black section bars drop out',
  ],
  plan: [
    'Destination — Save as PDF (or your printer)',
    'Paper size — Letter',
    'Margins — None (the page carries its own 0.6 in inset)',
    'Scale — 100%',
    'Background graphics — on',
  ],
}
