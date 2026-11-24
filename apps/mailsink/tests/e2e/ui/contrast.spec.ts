import type { Page } from '@playwright/test'
import { gotoHydrated } from '../goto-hydrated'
import { BASE_URL } from '../web-server'
import { expect, signIn, test } from './fixtures'

// IMPLEMENTATION §7 on the real screens: `--ms-accent-text` (links, focus, menu check) and
// the error colour must read at 4.5:1 on the page and panel backgrounds, in both themes.

/** WCAG contrast of two CSS colours, resolved by the browser (oklch included). */
async function contrast(page: Page, foreground: string, background: string): Promise<number> {
  return page.evaluate(
    ({ fg, bg }) => {
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 1
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) throw new Error('no canvas')
      const luminance = (color: string) => {
        const probe = document.createElement('div')
        probe.style.color = color
        document.body.append(probe)
        ctx.fillStyle = getComputedStyle(probe).color
        probe.remove()
        ctx.fillRect(0, 0, 1, 1)
        const [r = 0, g = 0, b = 0] = ctx.getImageData(0, 0, 1, 1).data
        const lin = (c: number) => {
          const s = c / 255
          return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
        }
        return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
      }
      const [a, b] = [luminance(fg), luminance(bg)].sort((x, y) => y - x)
      return ((a ?? 0) + 0.05) / ((b ?? 0) + 0.05)
    },
    { fg: foreground, bg: background },
  )
}

for (const theme of ['light', 'dark'] as const) {
  test(`accent text and errors are readable in the ${theme} theme`, async ({ page, context }) => {
    await context.addCookies([{ name: 'mailsink_theme', value: theme, url: BASE_URL }])
    await signIn(page)
    await gotoHydrated(page, '/w/no-such-workspace')
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme)

    const pairs: [string, string][] = [
      ['var(--ms-accent-text)', 'var(--ms-bg)'],
      ['var(--ms-accent-text)', 'var(--ms-panel)'],
      ['var(--ms-danger)', 'var(--ms-panel)'],
      ['var(--ms-text-muted)', 'var(--ms-panel)'],
    ]
    for (const [fg, bg] of pairs) {
      expect(await contrast(page, fg, bg), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5)
    }
    // The real link of the screen uses the token.
    const link = page.getByRole('link', { name: 'Choose a workspace' })
    expect(
      await contrast(page, await link.evaluate((el) => getComputedStyle(el).color), 'var(--ms-bg)'),
    ).toBeGreaterThanOrEqual(4.5)
  })
}
