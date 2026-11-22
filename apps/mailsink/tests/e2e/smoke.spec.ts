import { expect, test } from '@playwright/test'

test('GET /healthz reports the database as ok', async ({ request }) => {
  const response = await request.get('/healthz')
  expect(response.status()).toBe(200)
  expect(await response.json()).toMatchObject({ status: 'ok', checks: { database: 'ok' } })
})

test('the home page renders the branded shell', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('banner').getByRole('link', { name: 'mailsink' })).toBeVisible()
  await expect(
    page.getByRole('heading', { level: 1, name: 'Every email caught. None delivered.' }),
  ).toBeVisible()
  await expect(
    page.getByText('Catch every email your app sends, without delivering a single one.'),
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
