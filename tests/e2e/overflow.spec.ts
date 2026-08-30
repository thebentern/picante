import { expect, test } from '@playwright/test'
import { openApp } from './helpers'

/**
 * Overflow detection is a product requirement, not a nicety.
 *
 * Both card templates are fixed-height with overflow:hidden, so surplus content
 * is discarded with no warning, and margin-top:auto on a bottom-pinned element
 * collapses to 0 under pressure — meaning the block that disappears first is the
 * OPSEC notice. The design phase hit this four separate times. These tests are
 * what stop it from being a thing the app quietly does to users.
 */

const LONG = 'Assume every transmission is heard by someone outside the unit. '.repeat(8)

test.describe('overflow detection', () => {
  test('reports fitting content as fitting', async ({ page }) => {
    await openApp(page, 'label')
    await expect(page.getByText('Fits the page')).toBeVisible()
  })

  test('names the block, the pixel overrun, and blocks export', async ({ page }) => {
    await openApp(page, 'label')
    await page.getByRole('tab', { name: 'Content' }).click()

    await page.getByLabel('Thermal label remarks text').fill(LONG)
    await expect(page.getByText(/overflow problem/)).toBeVisible({ timeout: 10_000 })

    // Specific: which block, how many pixels over. "Content is too long" tells
    // someone editing 6.5 pt type nothing they can act on.
    const finding = page.locator('.status__row').first()
    await expect(finding).toContainText(/Label · remarks|Page/)
    await expect(finding).toContainText(/\d+(\.\d+)? px over/)

    await page.getByRole('tab', { name: 'Print' }).click()
    await expect(page.getByText('Content is overflowing')).toBeVisible()
    await expect(page.getByRole('button', { name: 'PNG · 300 dpi' })).toBeDisabled()

    // An escape hatch, because blocking outright is hostile to someone who
    // knows exactly what they are doing.
    await page.getByLabel('Export anyway').check()
    await expect(page.getByRole('button', { name: 'PNG · 300 dpi' })).toBeEnabled()
  })

  test('recovers when the content is trimmed back', async ({ page }) => {
    await openApp(page, 'label')
    await page.getByRole('tab', { name: 'Content' }).click()
    const field = page.getByLabel('Thermal label remarks text')

    await field.fill(LONG)
    await expect(page.getByText(/overflow problem/)).toBeVisible({ timeout: 10_000 })

    await field.fill('Call signs and waypoints only. Assume you are overheard.')
    await expect(page.getByText('Fits the page')).toBeVisible({ timeout: 10_000 })
  })

  test('catches the fold card overflowing too', async ({ page }) => {
    await openApp(page, 'fold')
    await expect(page.getByText('Fits the page')).toBeVisible()

    await page.getByRole('tab', { name: 'Content' }).click()
    await page.getByLabel('Fold card remarks text').fill(LONG)

    await expect(page.getByText(/overflow problem/)).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('.status__row').first()).toContainText('Back panel')
  })

  test('does not measure the plan, which flows onto more pages', async ({ page }) => {
    // The plan has no fixed page box — the print engine paginates it — so an
    // overflow report there would be meaningless noise.
    await openApp(page, 'plan')
    await expect(page.getByText('Fits the page')).toBeHidden()
    await expect(page.locator('.status')).toHaveCount(0)
  })
})
