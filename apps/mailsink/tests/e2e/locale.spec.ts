import { expect, test } from '@playwright/test'

const TAGLINE = {
  en: 'Catch every email your app sends, without delivering a single one.',
  fr: 'Interceptez chaque e-mail envoyé par votre application, sans en délivrer un seul.',
}

// Accept-Language comes from the browser locale.
test.use({ locale: 'fr-FR' })

test('Accept-Language fr renders the page in French', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr')
  await expect(page.getByText(TAGLINE.fr)).toBeVisible()
  await expect(page.getByLabel('Langue')).toHaveValue('fr')
  await expect(page.getByRole('button', { name: 'Basculer clair / sombre' })).toBeVisible()
})

test('switching to English updates the page in place and is remembered', async ({
  page,
  context,
}) => {
  await page.goto('/')
  await expect(page.getByText(TAGLINE.fr)).toBeVisible()

  // A full reload would drop this marker.
  await page.evaluate(() => {
    ;(window as Window & { e2eMarker?: boolean }).e2eMarker = true
  })
  await page.getByLabel('Langue').selectOption('en')

  await expect(page.getByText(TAGLINE.en)).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByLabel('Language')).toHaveValue('en')
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
