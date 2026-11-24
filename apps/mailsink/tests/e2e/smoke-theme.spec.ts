import { expect, test } from '@playwright/test'
import { gotoHydrated } from './goto-hydrated'
import { BASE_URL } from './web-server'

// B1-4: light by default, prefers-color-scheme ignored, the choice is remembered in a
// cookie and applied during SSR (no flash).

test.use({ colorScheme: 'dark' })

test('the page is light by default, even when the OS prefers dark', async ({ page }) => {
  await gotoHydrated(page, '/')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#f5f5f3')
  await expect(page.locator('html')).toHaveCSS('background-color', 'rgb(245, 245, 243)')
})

test('the toggle switches the theme in place and the server renders the choice', async ({
  page,
  context,
  request,
}) => {
  await gotoHydrated(page, '/')
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
  await gotoHydrated(page, '/')
  for (const font of ['400 13px Geist', '600 14px Geist', '500 12px "JetBrains Mono"']) {
    const faces = await page.evaluate(async (f) => (await document.fonts.load(f)).length, font)
    expect(faces, font).toBeGreaterThan(0)
  }
  expect([...origins]).toEqual([new URL(page.url()).origin])
})

// Proposition D184: faint texts (section labels, reassurance line, instance block) at 4.5:1
// on the page, panel and raised backgrounds, in both themes, as the browser resolves them.
for (const theme of ['light', 'dark'] as const) {
  test(`faint text reads at 4.5:1 in the ${theme} theme`, async ({ page, context }) => {
    await context.addCookies([{ name: 'mailsink_theme', value: theme, url: BASE_URL }])
    await gotoHydrated(page, '/login')
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
    const ratios = await page.evaluate(() => {
      const rgb = (name: string) => {
        const probe = document.createElement('div')
        probe.style.color = `var(${name})`
        document.body.append(probe)
        const parts = getComputedStyle(probe).color.match(/\d+(\.\d+)?/g) ?? []
        probe.remove()
        return parts.slice(0, 3).map(Number)
      }
      const luminance = (name: string) => {
        const [r = 0, g = 0, b = 0] = rgb(name).map((c) => {
          const s = c / 255
          return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
        })
        return 0.2126 * r + 0.7152 * g + 0.0722 * b
      }
      const faint = luminance('--ms-text-faint')
      return ['--ms-bg', '--ms-panel', '--ms-raised'].map((surface) => {
        const [a, b] = [faint, luminance(surface)].sort((x, y) => y - x)
        return ((a ?? 0) + 0.05) / ((b ?? 0) + 0.05)
      })
    })
    for (const ratio of ratios) expect(ratio).toBeGreaterThanOrEqual(4.5)
  })
}
