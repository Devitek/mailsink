import { expect, test } from '@playwright/test'

test('GET /healthz reports the database as ok', async ({ request }) => {
  const response = await request.get('/healthz')
  expect(response.status()).toBe(200)
  expect(await response.json()).toMatchObject({ status: 'ok', checks: { database: 'ok' } })
})

test('the home page renders the tagline', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Mailsink' })).toBeVisible()
  await expect(
    page.getByText('Catch every email your app sends, without delivering a single one.'),
  ).toBeVisible()
})
