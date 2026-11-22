import { expect, test } from '@playwright/test'

// Runs against the fallback build only: `de` is a test-only community locale where
// "Language" is translated and the tagline is not (see de.po).
const TAGLINE_EN = 'Catch every email your app sends, without delivering a single one.'

test.use({ locale: 'de-DE' })

test('a partially translated locale falls back to English per message', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('lang', 'de')
  await expect(page.getByLabel('Sprache')).toHaveValue('de')
  await expect(page.getByText(TAGLINE_EN)).toBeVisible()
})

test('switching to the community locale in the browser applies the same fallback', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByLabel('Sprache').selectOption('fr')
  await expect(page.getByLabel('Langue')).toHaveValue('fr')

  await page.getByLabel('Langue').selectOption('de')
  await expect(page.locator('html')).toHaveAttribute('lang', 'de')
  await expect(page.getByLabel('Sprache')).toHaveValue('de')
  await expect(page.getByText(TAGLINE_EN)).toBeVisible()
})
