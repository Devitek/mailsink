import { expect, type Page } from '@playwright/test'

/**
 * `page.goto` that resolves once React has hydrated the page (`<html data-hydrated>`, set
 * by the root route, D263). The server HTML is visible, and matches every locator, before
 * its handlers are attached: a click or a fill right after a plain `goto` may land on the
 * inert markup and be lost on a loaded host (#118, #132). Pages run without JavaScript use
 * `page.goto`.
 */
export async function gotoHydrated(page: Page, url: string): Promise<void> {
  await page.goto(url)
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', '')
}
