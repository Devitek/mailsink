import { expect, test } from '@playwright/test'
import { BASE_URL } from './web-server'

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

test('each page has its own localized title and Open Graph image (#36, #99)', async ({
  page,
  context,
  request,
}) => {
  await page.goto('/login')
  await expect(page).toHaveTitle('Sign in · Mailsink')
  const image = page.locator('meta[property="og:image"]')
  await expect(image).toHaveAttribute('content', `${BASE_URL}/og-image-en-1200x630.png`)

  await context.addCookies([{ name: 'mailsink_locale', value: 'fr', url: BASE_URL }])
  await page.goto('/login')
  await expect(page).toHaveTitle('Se connecter · Mailsink')
  await expect(image).toHaveAttribute('content', `${BASE_URL}/og-image-fr-1200x630.png`)
  await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute('content', 'fr_FR')

  for (const locale of ['en', 'fr']) {
    const png = await request.get(`/og-image-${locale}-1200x630.png`)
    expect(png.status(), locale).toBe(200)
    expect(png.headers()['content-type']).toBe('image/png')
  }
})
