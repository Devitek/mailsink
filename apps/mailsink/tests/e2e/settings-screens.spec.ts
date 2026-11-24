import { gotoHydrated } from './goto-hydrated'
import { expect, test } from './settings-fixtures'
import { signIn } from './ui/fixtures'
import { BASE_URL } from './web-server'

// Light and dark desktop screenshots of the #43 screens, for the pull request. Skipped
// unless E2E_SCREENSHOTS names the output directory.
const dir = process.env.E2E_SCREENSHOTS

test.skip(!dir, 'E2E_SCREENSHOTS not set')
test.use({ viewport: { width: 1440, height: 900 } })

for (const theme of ['light', 'dark'] as const) {
  test(`settings screens in ${theme}`, async ({ page, context, settingsWorkspace: ws }) => {
    await context.addCookies([{ name: 'mailsink_theme', value: theme, url: BASE_URL }])
    await signIn(page)
    const shot = (name: string) =>
      page.screenshot({ path: `${dir}/settings-${name}-${theme}.png`, fullPage: true })

    for (const section of ['connections', 'retention', 'simulation', 'mcp'] as const) {
      await gotoHydrated(page, `/w/${ws.slug}/settings?section=${section}`)
      await expect(page.getByRole('link', { name: 'Webhooks' })).toBeVisible()
      await shot(section)
    }

    await gotoHydrated(page, `/w/${ws.slug}/settings?section=webhooks`)
    await page.getByRole('button', { name: '+ Add an endpoint' }).click()
    const dialog = page.getByRole('dialog', { name: 'New webhook endpoint' })
    await dialog.getByLabel('URL').fill('http://127.0.0.1:9/hooks')
    await expect(dialog.getByTestId('preview-body')).toContainText('email.delivered')
    await shot('webhook-form')
    await dialog.getByRole('button', { name: 'Create the endpoint' }).click()
    await expect(dialog).toBeHidden()
    await shot('webhooks')

    await gotoHydrated(page, `/w/${ws.slug}/settings?section=templates`)
    await page.getByRole('button', { name: '+ New template' }).click()
    const editor = page.getByRole('dialog', { name: 'New Brevo template' })
    await editor.getByLabel('Name').fill('Welcome')
    await editor.getByLabel('Subject').fill('Welcome {{ params.name }}')
    await editor
      .getByLabel('HTML')
      .fill('<h1>Hello {{ params.name }}</h1><p>Your account is ready.</p>')
    await expect(editor.getByTestId('template-preview-subject')).toHaveText('Welcome Julie')
    await shot('template-editor')
  })
}
