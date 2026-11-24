import { gotoHydrated } from '../goto-hydrated'
import { LOGIN_LIMIT } from '../web-server'
import { ADMIN_KEY, expect, test } from './fixtures'

// L1e (B2-3): the server pauses a client after LOGIN_LIMIT.maxAttempts refused keys and
// answers 429 with Retry-After. Runs alone (project `login-limit`): the pause applies to
// 127.0.0.1, the address of every scenario.

test('too many attempts pause sign-in with a live countdown, then re-enable it', async ({
  page,
}) => {
  await gotoHydrated(page, '/login')
  const field = page.getByLabel('Admin key')
  const button = page.getByRole('button', { name: /^(Sign in|Try again in)/ })

  for (let attempt = 1; attempt < LOGIN_LIMIT.maxAttempts; attempt++) {
    await field.fill(`msk_admin_wrong_${attempt}`)
    await button.click()
    await expect(page.getByText('Key rejected.')).toBeVisible()
  }
  await field.fill('msk_admin_wrong_last')
  await button.click()

  const alert = page.getByRole('alert')
  await expect(alert).toContainText('Too many attempts.')
  await expect(alert).toContainText(/0:0[1-5]/)
  await expect(button).toHaveText(/Try again in 0:0[1-5]/)
  await expect(button).toBeDisabled()
  await expect(page.getByText(/attempts? left/)).toHaveCount(0)

  // The field stays editable during the pause: the right key can be pasted meanwhile.
  await field.fill(ADMIN_KEY)
  await expect(field).toBeEditable()

  // The server agrees: even the right key waits.
  const early = await page.request.post('/login', { data: { key: ADMIN_KEY } })
  expect(early.status()).toBe(429)
  expect(Number(early.headers()['retry-after'])).toBeGreaterThan(0)

  // At zero everything comes back without a reload.
  await page.evaluate(() => {
    ;(window as Window & { e2eMarker?: boolean }).e2eMarker = true
  })
  await expect(button).toHaveText('Sign in', { timeout: (LOGIN_LIMIT.lockSeconds + 2) * 1000 })
  await expect(alert).toHaveCount(0)
  await button.click()
  await expect(page).toHaveURL('/')
  expect(await page.evaluate(() => (window as Window & { e2eMarker?: boolean }).e2eMarker)).toBe(
    true,
  )
})
