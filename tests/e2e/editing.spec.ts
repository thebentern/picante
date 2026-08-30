import { expect, test } from '@playwright/test'
import { openApp } from './helpers'

/**
 * The editing model: the rendered card is the live preview, edited in place,
 * with a mirrored field panel as the accessible path. These cover the parts
 * that are easy to get subtly wrong — undo granularity, paste sanitation, and
 * the two views staying in sync.
 */

test.describe('editing', () => {
  test('edits on the card and in the panel are the same field', async ({ page }) => {
    await openApp(page, 'fold')
    await page.getByRole('tab', { name: 'Content' }).click()

    const panelField = page.getByRole('complementary').getByLabel('Title', { exact: true })
    const cardField = page.locator('#print-root [aria-label="Card title"]')

    await panelField.fill('Comms Card')
    await expect(cardField).toHaveText('Comms Card')

    // Select-all rather than End: on macOS, End scrolls the document instead of
    // moving the caret, so the shortcut is not portable across CI runners.
    await cardField.click()
    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.type('Comms Card v2')
    await cardField.blur()
    await expect(panelField).toHaveValue('Comms Card v2')
  })

  test('typing a phrase is one undo, not one per keystroke', async ({ page }) => {
    await openApp(page, 'fold')
    const cardField = page.locator('#print-root [aria-label="Card title"]')

    await cardField.click()
    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.type('Field Card')
    await cardField.blur()
    await expect(cardField).toHaveText('Field Card')

    await page.getByRole('button', { name: 'Undo' }).click()
    await expect(cardField).toHaveText('PACE Plan')
  })

  test('pasted rich text arrives as plain text', async ({ page }) => {
    // The document is JSON passed between machines; markup must not get in
    // through a paste and then be rendered into a print template.
    await openApp(page, 'fold')
    const cardField = page.locator('#print-root [aria-label="Organization"]')

    await cardField.click()
    await page.keyboard.press('ControlOrMeta+a')
    await page.evaluate(() => {
      const data = new DataTransfer()
      data.setData('text/plain', 'Example Response Group')
      data.setData('text/html', '<b onclick="alert(1)">Example Response Group</b>')
      document.activeElement?.dispatchEvent(
        new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }),
      )
    })
    await cardField.blur()

    await expect(cardField).toHaveText('Example Response Group')
    expect(await cardField.innerHTML()).not.toContain('<b')
  })

  test('a rollover token keeps tracking the channel list', async ({ page }) => {
    // The prose says "the unit rolls together 7 → 12 → 17 → 22" via a token, so
    // changing the channels changes the sentence. Editing the words around it
    // must not flatten the token into literal text.
    await openApp(page, 'fold')
    const tier = page.locator('#print-root [aria-label="A tier description"]')
    await expect(tier).toContainText('7 → 12 → 17 → 22')

    await tier.click()
    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.type('Unit rolls together {rollover}. Confirm on a radio check.')
    await tier.blur()

    await page.getByRole('tab', { name: 'Channels' }).click()
    await page.getByRole('button', { name: 'Remove GMRS 12' }).click()

    await expect(tier).toContainText('7 → 17 → 22')
    await expect(tier).toContainText('Confirm on a radio check.')
  })

  // Switching to preview is the first step of every export path, so a rendering
  // difference between the two modes ships to paper. It is also invisible to the
  // raster comparison, which diffs two renders of the *same* DOM: when the app
  // rendered every field twice in preview, both sides of that diff agreed
  // perfectly and the suite stayed green. These are the checks that see it.
  for (const template of ['fold', 'label', 'plan'] as const) {
    test(`${template}: switching to preview does not change the card's content`, async ({
      page,
    }) => {
      await openApp(page, template)
      const card = page.locator('#print-root')

      const inEditMode = await card.evaluate((el) => el.textContent)
      await page.getByRole('button', { name: 'Preview', exact: true }).click()
      await page.waitForTimeout(300)
      const inPreviewMode = await card.evaluate((el) => el.textContent)

      expect(inPreviewMode).toBe(inEditMode)

      // And back again, because the remount has to work in both directions.
      await page.getByRole('button', { name: 'Edit', exact: true }).click()
      await page.waitForTimeout(300)
      expect(await card.evaluate((el) => el.textContent)).toBe(inEditMode)
    })
  }

  test('no field renders twice on the exported card', async ({ page }) => {
    await openApp(page, 'fold')
    await page.getByRole('button', { name: 'Preview', exact: true }).click()
    await page.waitForTimeout(300)

    const text = (await page.locator('#print-root').evaluate((el) => el.textContent)) ?? ''
    const occurrences = (needle: string) => text.split(needle).length - 1

    // Each of these appears exactly once on the fold card.
    expect(occurrences('Example Response Group')).toBe(1)
    expect(occurrences('Severe weather & disaster response')).toBe(1)
    expect(occurrences('Use the first method that works')).toBe(1)
    expect(occurrences('PACE Plan')).toBe(1)

    // Nothing anywhere is an immediately-repeated run of itself.
    expect(text).not.toMatch(/(\b[A-Z][a-z]+ [A-Z][a-z]+\b)\1/)
  })

  test('channels are free text, not a band plan the app assumes', async ({ page }) => {
    // The whole point of the generic input: a unit on MURS, business band or an
    // amateur allocation types what it uses and it flows through everywhere.
    await openApp(page, 'fold')
    await page.getByRole('tab', { name: 'Channels' }).click()

    const panel = page.getByRole('complementary')
    await panel.getByLabel('Channel 1 name').fill('MURS 3')
    await panel.getByLabel('Channel 1 short').fill('M3')
    await panel.getByLabel('Channel 1 frequency (MHz)').fill('151.9400')

    // The card's channel table, the rollover token in the PACE copy, and the
    // plan all read from the same list.
    await expect(page.locator('#print-root')).toContainText('MURS 3')
    await expect(page.locator('#print-root')).toContainText('151.9400')
    await expect(page.locator('#print-root [aria-label="A tier description"]')).toContainText(
      'M3 → 12 → 17 → 22',
    )
  })

  test('a band plan can be inserted without constraining what a channel is', async ({ page }) => {
    await openApp(page, 'fold')
    await page.getByRole('tab', { name: 'Channels' }).click()
    const panel = page.getByRole('complementary')

    await panel.getByRole('combobox').selectOption('murs:4')

    const rows = await panel.getByLabel(/^Channel \d+ name$/).all()
    const added = rows[rows.length - 1]!
    await expect(added).toHaveValue('MURS 4')
    await expect(panel.getByLabel(`Channel ${rows.length} frequency (MHz)`)).toHaveValue('154.5700')

    // Inserted, not locked: it edits like any other row.
    await added.fill('Ops simplex')
    await expect(page.locator('#print-root')).toContainText('Ops simplex')
  })

  test('the remarks heading is the user’s, not a fixed OPSEC label', async ({ page }) => {
    await openApp(page, 'fold')
    await page.getByRole('tab', { name: 'Content' }).click()

    const heading = page.getByRole('complementary').getByLabel('Fold card remarks heading')
    await expect(heading).toHaveValue('OPSEC')
    await heading.fill('Muster notes')

    const block = page.locator('[data-block="Remarks"]')
    await expect(block).toContainText('Muster notes')
    await expect(block).not.toContainText('OPSEC')
  })

  test('the label ignores PACE tier colours and prints black', async ({ page }) => {
    // The QL-500 is a 1-bit device with no greys; a coloured cell would dither
    // into noise.
    await openApp(page, 'label')
    const letterCell = page.locator('[data-block="Label · PACE ladder"] > div > div').first()
    await expect(letterCell).toHaveCSS('background-color', 'rgb(0, 0, 0)')
  })
})
