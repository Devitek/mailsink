import { expect, test } from '@playwright/test'

// B1-4: light by default, prefers-color-scheme ignored, the choice is remembered in a
// cookie and applied during SSR (no flash).

test.use({ colorScheme: 'dark' })

test('the page is light by default, even when the OS prefers dark', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#f5f5f3')
  await expect(page.locator('html')).toHaveCSS('background-color', 'rgb(245, 245, 243)')
})

test('the toggle switches the theme in place and the server renders the choice', async ({
  page,
  context,
  request,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Toggle light / dark' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#0b0c0e')

  await expect
    .poll(async () => (await context.cookies()).find((c) => c.name === 'mailsink_theme')?.value)
    .toBe('dark')

  // The server HTML already carries the theme: nothing to repaint after hydration.
  const html = await (
    await request.get('/login', { headers: { cookie: 'mailsink_theme=dark' } })
  ).text()
  expect(html).toMatch(/<html[^>]*data-theme="dark"/)

  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.getByRole('button', { name: 'Toggle light / dark' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
})

test('fonts are self-hosted', async ({ page }) => {
  const origins = new Set<string>()
  page.on('request', (req) => {
    origins.add(new URL(req.url()).origin)
  })
  await page.goto('/')
  for (const font of ['400 13px Geist', '600 14px Geist', '500 12px "JetBrains Mono"']) {
    const faces = await page.evaluate(async (f) => (await document.fonts.load(f)).length, font)
    expect(faces, font).toBeGreaterThan(0)
  }
  expect([...origins]).toEqual([new URL(page.url()).origin])
})
