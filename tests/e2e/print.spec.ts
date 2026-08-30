import { expect, test } from '@playwright/test'
import { openApp, setPreview } from './helpers'

/**
 * The print path, exercised through Chromium's own print pipeline with
 * `preferCSSPageSize` — which is exactly what "Save as PDF" does in the browser.
 *
 * This is where the @page geometry injected by <Page> gets proven: one page at
 * the declared size, no reflow, no second blank sheet. The handoff's warning
 * about `width` + `aspect-ratio` spilling a blank sheet after every page is the
 * kind of thing only this catches.
 */

/** Page boxes as a PDF reader sees them, in points. */
const MEDIA_BOX = /\/MediaBox\s*\[\s*([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s*\]/g

function pageBoxes(pdf: Buffer): { width: number; height: number }[] {
  const source = pdf.toString('latin1')
  return [...source.matchAll(MEDIA_BOX)].map((m) => ({
    width: Number(m[3]) - Number(m[1]),
    height: Number(m[4]) - Number(m[2]),
  }))
}

test.describe('print to PDF', () => {
  test('fold card is one Letter page', async ({ page }) => {
    await openApp(page, 'fold')
    await setPreview(page)
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true })

    const boxes = pageBoxes(pdf)
    expect(boxes, 'single-sided: one sheet, folded, not two').toHaveLength(1)
    // 8.5 x 11 in = 612 x 792 pt.
    expect(boxes[0]!.width).toBeCloseTo(612, 0)
    expect(boxes[0]!.height).toBeCloseTo(792, 0)
  })

  test('label is one page at exactly 62 × 100 mm', async ({ page }) => {
    await openApp(page, 'label')
    await setPreview(page)
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true })

    const boxes = pageBoxes(pdf)
    expect(boxes).toHaveLength(1)
    // Chromium's print pipeline quantizes the page box to hundredths of an
    // inch, so 100 mm comes out as 3.93 in (99.82 mm) rather than exactly
    // 283.46 pt. That is a fifth of a millimetre on a label whose printable
    // length is 93.9 mm, and it is precisely why the pdf-lib export — which is
    // exact to the point — is the primary PDF path for this template.
    expect(boxes[0]!.width).toBeCloseTo(175.7, 0)
    expect(Math.abs(boxes[0]!.height - 283.46)).toBeLessThan(1)
  })

  test('plan paginates onto several Letter pages', async ({ page }) => {
    await openApp(page, 'plan')
    await setPreview(page)
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true })

    const boxes = pageBoxes(pdf)
    expect(boxes.length).toBeGreaterThan(3)
    for (const box of boxes) {
      expect(box.width).toBeCloseTo(612, 0)
      expect(box.height).toBeCloseTo(792, 0)
    }
  })

  test('editing chrome never reaches paper, and the card still does', async ({ page }) => {
    // Deliberately left in edit mode: the toolbar and sidebar are on screen and
    // none of it may print. The second half of that sentence matters just as
    // much — an over-broad hiding rule prints a perfectly sized blank page,
    // which is what the first version of this CSS did.
    await openApp(page, 'fold')
    await page.emulateMedia({ media: 'print' })

    await expect(page.locator('#print-root .doc-page')).toBeVisible()
    await expect(page.locator('[data-block="PACE ladder"]')).toBeVisible()
    await expect(page.getByText('Use the first method that works')).toBeVisible()

    await expect(page.locator('.toolbar')).toBeHidden()
    await expect(page.locator('.sidebar')).toBeHidden()
    await expect(page.getByRole('tab', { name: 'Print' })).toBeHidden()

    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true })
    expect(pageBoxes(pdf)).toHaveLength(1)
  })

  test('the fold card back panel is rotated on paper even while editing upright', async ({
    page,
  }) => {
    // Editing unwinds the 180° rotation so the caret behaves; export must put
    // it back, or the card folds to an upside-down back face.
    await openApp(page, 'fold')
    const transformWhileEditing = await page
      .locator('[data-block="Back panel"]')
      .evaluate((el) => getComputedStyle(el).transform)
    expect(transformWhileEditing).toBe('none')

    await setPreview(page)
    const transformOnExport = await page
      .locator('[data-block="Back panel"]')
      .evaluate((el) => getComputedStyle(el).transform)
    // rotate(180deg) is matrix(-1, 0, 0, -1, 0, 0).
    expect(transformOnExport).toBe('matrix(-1, 0, 0, -1, 0, 0)')
  })
})
