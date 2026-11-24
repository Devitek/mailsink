import { expect, test } from '@playwright/test'
import { gotoHydrated } from './goto-hydrated'

// Baseline of the sign-in screen, the first page a signed-out visitor sees (brief 2 copy).
const TAGLINE = {
  en: 'Every email caught. None delivered.',
  fr: 'Tout arrive. Rien ne part.',
}

// Accept-Language comes from the browser locale.
test.use({ locale: 'fr-FR' })

test('Accept-Language fr renders the page in French', async ({ page }) => {
  await gotoHydrated(page, '/login')
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr')
  await expect(page.getByText(TAGLINE.fr)).toBeVisible()
  await expect(page.getByRole('heading', { name: "Connexion à l'instance" })).toBeVisible()
  const languages = page.getByRole('group', { name: 'Langue' })
  await expect(languages.getByRole('button', { name: 'Français' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(languages.getByRole('button', { name: 'English' })).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('button', { name: 'Basculer clair / sombre' })).toBeVisible()
})

test('switching to English updates the page in place and is remembered', async ({
  page,
  context,
}) => {
  await gotoHydrated(page, '/login')
  await expect(page.getByText(TAGLINE.fr)).toBeVisible()
  // Typed text survives the switch: no reload, the form keeps its state.
  await page.getByLabel("Clé d'administration").fill('msk_admin_typed')

  // A full reload would drop this marker.
  await page.evaluate(() => {
    ;(window as Window & { e2eMarker?: boolean }).e2eMarker = true
  })
  await page.getByRole('group', { name: 'Langue' }).getByRole('button', { name: 'English' }).click()

  await expect(page.getByText(TAGLINE.en)).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(
    page.getByRole('group', { name: 'Language' }).getByRole('button', { name: 'English' }),
  ).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByLabel('Admin key')).toHaveValue('msk_admin_typed')
  expect(await page.evaluate(() => (window as Window & { e2eMarker?: boolean }).e2eMarker)).toBe(
    true,
  )

  const cookies = await context.cookies()
  expect(cookies).toContainEqual(expect.objectContaining({ name: 'mailsink_locale', value: 'en' }))

  // The cookie wins over Accept-Language fr on the next server render.
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByText(TAGLINE.en)).toBeVisible()
})
