import { expect, test } from '@playwright/test'

test('GET /healthz reports the database as ok', async ({ request }) => {
  const response = await request.get('/healthz')
  expect(response.status()).toBe(200)
  expect(await response.json()).toMatchObject({ status: 'ok', checks: { database: 'ok' } })
})

test('a signed-out visitor of the home page gets the branded sign-in screen', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL('/login?redirect=%2F')
  await expect(page.getByText('mailsink', { exact: true })).toBeVisible()
  await expect(page.getByText('Every email caught. None delivered.')).toBeVisible()
  await expect(
    page.getByRole('heading', { level: 1, name: 'Sign in to this instance' }),
  ).toBeVisible()
})

test('the brand assets are served', async ({ request }) => {
  for (const path of ['/favicon.svg', '/mark-32.png', '/apple-touch-icon-180.png']) {
    expect((await request.get(path)).status(), path).toBe(200)
  }
  const manifest = await (await request.get('/manifest.webmanifest')).json()
  expect(manifest.icons).toContainEqual(expect.objectContaining({ purpose: 'maskable' }))
  expect((await request.get(manifest.icons[0].src)).status()).toBe(200)
})
