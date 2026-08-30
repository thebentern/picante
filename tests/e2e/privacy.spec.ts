import { expect, test } from '@playwright/test'
import { openApp } from './helpers'

/**
 * This is a tool whose own printed advice is "avoid real names and home
 * locations". A silent third-party request carrying a rally point address would
 * contradict the card it is printing, so both network features are off until
 * the user turns them on, and the geocode dialog shows the exact URL first.
 */

test.describe('privacy', () => {
  test('makes no third-party request on load or while editing', async ({ page }) => {
    const external: string[] = []
    await page.route('**', (route) => {
      const url = route.request().url()
      if (!url.startsWith('http://127.0.0.1:4173') && !url.startsWith('data:')) external.push(url)
      return route.continue()
    })

    await openApp(page, 'plan')
    await page.getByRole('tab', { name: 'Content' }).click()
    // The card and the sidebar expose the same field under the same name, on
    // purpose; scope to the sidebar.
    await page
      .getByRole('complementary')
      .getByLabel('Organization', { exact: true })
      .fill('Example Response Group')
    await page.waitForTimeout(800)

    expect(external).toEqual([])
  })

  test('asks before sending an address to OpenStreetMap, and shows the exact URL', async ({
    page,
  }) => {
    const nominatim: string[] = []
    await page.route('**nominatim**', (route) => {
      nominatim.push(route.request().url())
      return route.fulfill({ status: 200, body: '[]', contentType: 'application/json' })
    })

    await openApp(page, 'plan')
    await page.getByRole('tab', { name: 'Rally' }).click()

    await page.getByLabel('Venue').first().fill('Example Community Center')
    await page.getByLabel('Street').first().fill('100 Example Road')
    await page.getByLabel('City', { exact: true }).first().fill('Anytown')

    await page.getByRole('button', { name: 'Look up address…' }).first().click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('nominatim.openstreetmap.org')
    // The exact request, not a summary of it.
    await expect(dialog.locator('.code')).toContainText('Example+Community+Center')
    expect(nominatim, 'nothing may be sent before the user agrees').toEqual([])

    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await page.waitForTimeout(300)
    expect(nominatim).toEqual([])

    await page.getByRole('button', { name: 'Look up address…' }).first().click()
    await page.getByRole('button', { name: 'Send it' }).click()
    await expect.poll(() => nominatim.length).toBe(1)
  })

  test('draws no map tiles until maps are turned on', async ({ page }) => {
    const tiles: string[] = []
    await page.route('**tile.openstreetmap.org**', (route) => {
      tiles.push(route.request().url())
      return route.abort()
    })

    await openApp(page, 'plan')
    await page.getByRole('tab', { name: 'Rally' }).click()
    // Ask for a map on a point that has coordinates.
    // Mid-Atlantic and deliberately imprecise: a synthetic value that is not a
    // place anyone works from.
    await page.getByLabel('Coordinates').first().fill('10.5, -20.5')
    await page.getByLabel(/Street map in the plan/).first().check()
    await page.waitForTimeout(800)
    expect(tiles).toEqual([])

    await page.getByLabel(/Draw maps in the plan template/).check()
    await expect.poll(() => tiles.length, { timeout: 10_000 }).toBeGreaterThan(0)
  })

  test('keeps the document in the browser and says so', async ({ page }) => {
    await openApp(page, 'fold')
    await page.getByRole('tab', { name: 'File' }).click()
    await expect(page.getByText('This document never leaves your browser')).toBeVisible()
  })
})
