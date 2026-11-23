import { ADMIN_KEY, expect, plantExpiredSession, test } from './fixtures'

// Sign-in screen of brief 2 (L1a to L1d) against the real server: admin key exchanged for
// the session cookie, refused key, expired session returning to the page asked for.

test('a signed-out visitor signs in and lands on the page asked for', async ({
  page,
  workspace,
  context,
}) => {
  const ws = await workspace()
  await page.goto(`/w/${ws.slug}`)

  await expect(page).toHaveURL(`/login?redirect=${encodeURIComponent(`/w/${ws.slug}`)}`)
  await expect(page.getByRole('heading', { name: 'Sign in to this instance' })).toBeVisible()
  // L1a: focus in the field, masked, the button disabled while it is empty, no banner.
  const field = page.getByLabel('Admin key')
  await expect(field).toBeFocused()
  await expect(field).toHaveAttribute('type', 'password')
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeDisabled()
  await expect(page.getByRole('status')).toHaveCount(0)

  await field.fill(ADMIN_KEY)
  await page.getByRole('button', { name: 'Show' }).click()
  await expect(field).toHaveAttribute('type', 'text')
  await page.getByRole('button', { name: 'Hide' }).click()
  await field.press('Enter')

  await expect(page).toHaveURL(`/w/${ws.slug}`)
  await expect(page.getByRole('heading', { name: ws.name })).toBeVisible()
  const session = (await context.cookies()).find((c) => c.name === 'mailsink_session')
  expect(session).toMatchObject({ httpOnly: true, sameSite: 'Lax' })
  expect(session?.value).not.toContain(ADMIN_KEY)
})

test('a refused key keeps the visitor on the screen, without an attempts count', async ({
  page,
  context,
}) => {
  await page.goto('/login')
  const field = page.getByLabel('Admin key')
  await field.fill('msk_admin_wrong')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()

  // L1b: linked error, field invalid, focused, its content selected to be replaced.
  const error = page.getByText('Key rejected.')
  await expect(error).toBeVisible()
  await expect(page.getByText(/attempts? left/)).toHaveCount(0)
  await expect(field).toHaveAttribute('aria-invalid', 'true')
  const describedBy = (await field.getAttribute('aria-describedby')) ?? ''
  const errorId = await page.locator('[data-slot="field-error"]').getAttribute('id')
  expect(describedBy.split(' ')).toContain(errorId)
  await expect(field).toBeFocused()
  expect(
    await field.evaluate((el: HTMLInputElement) => [el.selectionStart, el.selectionEnd]),
  ).toEqual([0, 'msk_admin_wrong'.length])
  expect((await context.cookies()).some((c) => c.name === 'mailsink_session')).toBe(false)

  // Typing again clears the error.
  await field.fill('msk_admin_')
  await expect(error).toHaveCount(0)
  await expect(field).not.toHaveAttribute('aria-invalid', 'true')
})

test('an expired session returns to its page after signing in again', async ({
  page,
  workspace,
}) => {
  const ws = await workspace()
  await plantExpiredSession(page)
  await page.goto(`/w/${ws.slug}`)

  // L1d: a status banner naming the page to return to.
  const banner = page.getByRole('status')
  await expect(banner).toContainText('Your session has expired.')
  await expect(banner).toContainText(`/w/${ws.slug}`)

  await page.getByLabel('Admin key').fill(ADMIN_KEY)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(`/w/${ws.slug}`)
})

test('signing out drops the session; the sign-in page then shows no expiry banner', async ({
  page,
  context,
}) => {
  await page.goto('/login')
  await page.getByLabel('Admin key').fill(ADMIN_KEY)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Choose a workspace' })).toBeVisible()

  await page.getByRole('button', { name: 'Language and session' }).click()
  await page.getByRole('menuitem', { name: 'Sign out' }).click()

  await expect(page).toHaveURL('/login')
  await expect(page.getByRole('status')).toHaveCount(0)
  expect((await context.cookies()).some((c) => c.name === 'mailsink_session')).toBe(false)
  await page.goto('/')
  await expect(page).toHaveURL('/login?redirect=%2F')
})

test('a signed-in visitor skips the sign-in page', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Admin key').fill(ADMIN_KEY)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL('/')
  await page.goto('/login?redirect=https://evil.test/')
  await expect(page).toHaveURL('/')
})
