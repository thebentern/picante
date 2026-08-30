import { expect, test } from '@playwright/test'
import { PNG } from 'pngjs'
import jsQR from 'jsqr'
import { openApp, setPreview, downloadBytes } from './helpers'
import { syntheticSet } from '../support/mesh'

/**
 * "The printed label QR scans at 16 mm" is an acceptance criterion you can only
 * finally settle with a real printer and a real phone. This gets as close as
 * software can: decode the QR out of the actual 300 dpi, 1-bit export — after
 * the downsample and the hard threshold, which is where a QR with too many
 * modules stops being readable.
 *
 * The channel set here is synthetic. Nothing real is committed.
 */

test.describe('provisioning QR', () => {
  test('survives the 1-bit threshold at 16 mm and decodes to the same URL', async ({ page }) => {
    await openApp(page, 'label')

    const url = syntheticSet(2)
    await page.getByRole('tab', { name: 'Mesh' }).click()
    await page.getByLabel('Meshtastic provisioning URL').fill(url)
    await page.getByRole('button', { name: 'Decode and use' }).click()
    await expect(page.getByText('2 channels read from the code')).toBeVisible()

    await setPreview(page)
    await page.getByRole('tab', { name: 'Print' }).click()
    const bytes = await downloadBytes(page, 'PNG · 300 dpi')

    const png = PNG.sync.read(bytes)
    const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height)

    expect(decoded, 'the QR did not decode from the printed raster').not.toBeNull()
    expect(decoded!.data).toBe(url)
  })

  test('warns when the channel set makes the code too dense to print small', async ({ page }) => {
    // A big channel set pushes the symbol past what a 300 dpi thermal head can
    // hold at 16 mm. Saying so beats printing a roll of labels to find out.
    await openApp(page, 'label')

    const url = syntheticSet(8)
    await page.getByRole('tab', { name: 'Mesh' }).click()
    await page.getByLabel('Meshtastic provisioning URL').fill(url)
    await page.getByRole('button', { name: 'Decode and use' }).click()

    await expect(page.getByText('This QR may not scan off a printed label')).toBeVisible()
    await expect(page.getByText(/printer dots per module/)).toBeVisible()
  })
})
