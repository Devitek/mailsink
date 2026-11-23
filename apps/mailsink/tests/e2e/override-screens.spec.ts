import { randomUUID } from 'node:crypto'
import { createWorkspace } from './recipe/fixtures'
import { expect, signIn, test } from './ui/fixtures'
import { BASE_URL } from './web-server'

// Light and dark desktop screenshots of the #42 screens (override panel, header pill,
// suppression list), for the pull request. Skipped unless E2E_SCREENSHOTS names the output
// directory.
const dir = process.env.E2E_SCREENSHOTS

test.skip(!dir, 'E2E_SCREENSHOTS not set')
test.use({ viewport: { width: 1440, height: 900 } })

for (const theme of ['light', 'dark'] as const) {
  test(`override and suppression screens in ${theme}`, async ({
    page,
    playwright,
    admin,
    context,
  }) => {
    const ws = await createWorkspace(playwright, admin, `screens ${randomUUID().slice(0, 8)}`)
    const slug = (await (await admin.get(`/admin/workspaces/${ws.id}`)).json()).slug
    await ws.capture.post('/capture/override', {
      data: {
        ttl: 3600,
        config: {
          rates: { delivered: 70, hard_bounce: 20, soft_bounce: 10 },
          latency: { minMs: 200, maxMs: 1500 },
          rules: [
            { match: '*+bounce@*', status: 'hard_bounce' },
            { match: '*@slow.test', delayMs: 30000 },
          ],
        },
      },
    })
    for (const to of ['ada+bounce@example.test', 'bob+bounce@example.test']) {
      await ws.send({ from: 'app@example.test', to, subject: 'Hi', text: 'hello' })
    }
    await context.addCookies([{ name: 'mailsink_theme', value: theme, url: BASE_URL }])
    await signIn(page)

    await page.goto(`/w/${slug}`)
    await expect(page.getByTestId('override-pill')).toBeVisible()
    await page.screenshot({ path: `${dir}/override-pill-${theme}.png` })
    await page.getByRole('button', { name: /^Override active/ }).click()
    const panel = page.getByRole('dialog', { name: 'Override settings' })
    await expect(panel).toBeVisible()
    await page.waitForTimeout(300)
    await page.screenshot({ path: `${dir}/override-panel-${theme}.png` })
    await panel.getByRole('textbox', { name: 'complained rate' }).fill('15')
    await panel.getByRole('button', { name: 'Reset to defaults' }).click()
    await page.screenshot({ path: `${dir}/override-panel-invalid-reset-${theme}.png` })

    await page.goto(`/w/${slug}/suppressions`)
    await expect(page.getByRole('row').filter({ hasText: '+bounce@' })).toHaveCount(2)
    await expect(page.getByTestId('override-pill')).toBeVisible()
    await page.screenshot({ path: `${dir}/suppressions-${theme}.png` })
    await ws.dispose()
  })
}
