import { gotoHydrated } from '../goto-hydrated'
import { expect, signIn, test } from './fixtures'

// « Language and session » menu of the header (H2a to H2c, B2-4).

test('the menu switches the language in place and stays open', async ({ page, context }) => {
  await signIn(page)
  await gotoHydrated(page, '/')
  await page.evaluate(() => {
    ;(window as Window & { e2eMarker?: boolean }).e2eMarker = true
  })

  const trigger = page.getByRole('button', { name: 'Language and session' })
  await expect(trigger).toHaveText(/en/i)
  await trigger.click()

  const menu = page.getByRole('menu')
  const english = menu.getByRole('menuitemradio', { name: 'English' })
  const french = menu.getByRole('menuitemradio', { name: 'Français' })
  await expect(english).toHaveAttribute('aria-checked', 'true')
  await expect(french.locator('[lang="fr"]')).toHaveText('Français')
  // Instance reminder: MAILSINK_PUBLIC_URL and the version.
  await expect(menu).toContainText(/Instancehttps?:\/\/\S+mailsink \d/)
  await expect(menu.getByRole('menuitem', { name: 'Sign out' })).toBeVisible()

  await french.click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr')
  // Still open, now in French, with the check on Français.
  await expect(menu.getByRole('menuitemradio', { name: 'Français' })).toHaveAttribute(
    'aria-checked',
    'true',
  )
  await expect(menu.getByRole('menuitem', { name: 'Se déconnecter' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Choisir un workspace' })).toBeVisible()
  expect(await page.evaluate(() => (window as Window & { e2eMarker?: boolean }).e2eMarker)).toBe(
    true,
  )

  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Langue et session' })).toHaveText(/fr/i)
  const cookies = await context.cookies()
  expect(cookies).toContainEqual(expect.objectContaining({ name: 'mailsink_locale', value: 'fr' }))
})
