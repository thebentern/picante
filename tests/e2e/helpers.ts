import type { Page } from '@playwright/test'

export * from '../support/compare'

export const TEMPLATE_BUTTON = {
  fold: 'Fold card',
  label: 'Thermal label',
  plan: 'Full plan',
} as const

/**
 * Open the app on a known document. Local storage is cleared first so a stale
 * autosave from a previous run cannot change what is measured.
 */
export async function openApp(page: Page, template: keyof typeof TEMPLATE_BUTTON = 'label') {
  await page.addInitScript(() => window.localStorage.clear())
  await page.goto('/')
  await page.getByRole('button', { name: TEMPLATE_BUTTON[template], exact: true }).click()
  await page.evaluate(() => document.fonts.ready)
  // One settled frame after fonts: measurement and rasterization must agree.
  await page.waitForTimeout(400)
}

/** Set the stage zoom. Export output must not depend on it — see raster.spec. */
export async function setZoom(page: Page, zoom: '0.5' | '0.65' | '0.8' | '1') {
  await page.getByLabel('Zoom').selectOption(zoom)
  await page.waitForTimeout(250)
}

export async function setPreview(page: Page) {
  await page.getByRole('button', { name: 'Preview', exact: true }).click()
  await page.waitForTimeout(200)
}

/** Click an export button and return the bytes it handed to the browser. */
export async function downloadBytes(page: Page, buttonName: string): Promise<Buffer> {
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 60_000 }),
    page.getByRole('button', { name: buttonName }).click(),
  ])
  const stream = await download.createReadStream()
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks)
}
