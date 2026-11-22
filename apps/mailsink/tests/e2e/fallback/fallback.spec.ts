import { expect, type Page, test } from '@playwright/test'
import { TAGLINE_EN_OVERRIDE, TAGLINE_SOURCE } from './messages'

// Runs against the fallback build only: `de` is a test-only community locale where
// "Language" is translated and the tagline is not (see de.po). The build's EN catalog
// translates the tagline as TAGLINE_EN_OVERRIDE, so seeing it proves the fallback reads the
// EN catalog, not the source text.
async function expectEnglishFallback(page: Page) {
  await expect(page.getByText(TAGLINE_EN_OVERRIDE)).toBeVisible()
  await expect(page.getByText(TAGLINE_SOURCE)).toHaveCount(0)
}

test.use({ locale: 'de-DE' })

test('a partially translated locale falls back to the EN catalog per message', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('lang', 'de')
  await expect(page.getByLabel('Sprache')).toHaveValue('de')
  await expectEnglishFallback(page)
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
  await expectEnglishFallback(page)
})
