import { gotoHydrated } from '../goto-hydrated'
import { booking, expect, test } from '../inbox-fixtures'
import { BASE_URL } from '../web-server'
import { signIn } from './fixtures'

// Light and dark screenshots of the screens of the first UI wave follow-up (#104, #106),
// for the pull request. Skipped unless E2E_SCREENSHOTS names the output directory.
const dir = process.env.E2E_SCREENSHOTS

test.skip(!dir, 'E2E_SCREENSHOTS not set')

for (const theme of ['light', 'dark'] as const) {
  test(`follow-up screens in ${theme}`, async ({ page, context, inbox, workspace }) => {
    await context.addCookies([{ name: 'mailsink_theme', value: theme, url: BASE_URL }])
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    const ws = await inbox()
    await ws.send(booking)
    const ci = await workspace({ ephemeral: true })
    await signIn(page)
    await page.setViewportSize({ width: 1440, height: 900 })

    await gotoHydrated(page, `/w/${ws.slug}`)
    await page.getByRole('tab', { name: 'Headers & MIME' }).click()
    await expect(page.getByText(`"subject": "${booking.subject}"`)).toBeVisible()
    await page.screenshot({ path: `${dir}/viewer-payload-${theme}.png` })
    await page.getByRole('tab', { name: 'Preview' }).click()
    await page.getByRole('switch', { name: 'Block remote images' }).click()
    await page.screenshot({ path: `${dir}/preview-block-remote-${theme}.png` })

    await gotoHydrated(page, `/w/${ws.slug}/connections`)
    await page
      .getByRole('region', { name: 'Workspace key' })
      .getByRole('button', { name: 'Rotate' })
      .click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Rotate the key' }).click()
    await page.getByRole('button', { name: 'Copy the workspace key' }).click()
    await expect(page.getByText('Copied to the clipboard')).toBeVisible()
    await page.waitForTimeout(400) // end of the entry transition
    await page.screenshot({ path: `${dir}/connections-key-toast-${theme}.png`, fullPage: true })

    await gotoHydrated(page, `/w/${ci.slug}`)
    await page.getByRole('button', { name: `Workspace: ${ci.slug}` }).click()
    await page.getByRole('searchbox', { name: 'Search workspaces' }).fill('ui ')
    await page.waitForTimeout(400)
    await page.screenshot({ path: `${dir}/ephemeral-banner-picker-${theme}.png` })

    await page.setViewportSize({ width: 390, height: 844 })
    await gotoHydrated(page, `/w/${ws.slug}`)
    await page.screenshot({ path: `${dir}/mobile-inbox-${theme}.png` })
    await page.getByRole('list', { name: 'Messages' }).getByRole('link').first().click()
    await page.screenshot({ path: `${dir}/mobile-viewer-${theme}.png` })
  })
}
