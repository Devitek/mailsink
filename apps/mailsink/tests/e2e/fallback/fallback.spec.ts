import { expect, type Page, test } from '@playwright/test'
import { TAGLINE_EN_OVERRIDE, TAGLINE_SOURCE } from './messages'

// Runs against the fallback build only, served with MAILSINK_UI_AUTH=none (no sign-in, the
// picker page is the home): `de` is a test-only community locale where the « Language and
// session » menu is translated and a line of the picker page is not (see de.po). The
// build's EN catalog translates that line as TAGLINE_EN_OVERRIDE, so seeing it proves the
// fallback reads the EN catalog, not the source text.
async function expectEnglishFallback(page: Page) {
  await expect(page.getByText(TAGLINE_EN_OVERRIDE)).toBeVisible()
  await expect(page.getByText(TAGLINE_SOURCE)).toHaveCount(0)
}

const pick = async (page: Page, menuLabel: string, language: string) => {
  await page.getByRole('button', { name: menuLabel }).click()
  await page.getByRole('menuitemradio', { name: language }).click()
  await page.keyboard.press('Escape')
}

test.use({ locale: 'de-DE' })

test('a partially translated locale falls back to the EN catalog per message', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('lang', 'de')
  await page.getByRole('button', { name: 'Sprache und Sitzung' }).click()
  const menu = page.getByRole('menu')
  await expect(menu.getByRole('menuitemradio', { name: 'Deutsch' })).toHaveAttribute(
    'aria-checked',
    'true',
  )
  // H2d: without protection the sign-out line is a note (untranslated here: EN fallback).
  await expect(menu).toContainText('Protection disabled MAILSINK_UI_AUTH=none')
  await expect(menu.getByRole('menuitem')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expectEnglishFallback(page)
})

test('switching to the community locale in the browser applies the same fallback', async ({
  page,
}) => {
  await page.goto('/')
  await pick(page, 'Sprache und Sitzung', 'Français')
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr')

  await pick(page, 'Langue et session', 'Deutsch')
  await expect(page.locator('html')).toHaveAttribute('lang', 'de')
  await expect(page.getByRole('button', { name: 'Sprache und Sitzung' })).toHaveText(/de/i)
  await expectEnglishFallback(page)
})
