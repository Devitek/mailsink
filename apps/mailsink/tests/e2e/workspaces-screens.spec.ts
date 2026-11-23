import { expect, signIn, test } from './ui/fixtures'
import { BASE_URL } from './web-server'

// Light and dark desktop screenshots of the #38 screens, for the pull request. Skipped
// unless E2E_SCREENSHOTS names the output directory.
const dir = process.env.E2E_SCREENSHOTS

test.skip(!dir, 'E2E_SCREENSHOTS not set')
test.use({ viewport: { width: 1440, height: 900 } })

for (const theme of ['light', 'dark'] as const) {
  test(`screens in ${theme}`, async ({ page, workspace, context }) => {
    const ws = await workspace()
    await context.addCookies([{ name: 'mailsink_theme', value: theme, url: BASE_URL }])
    await signIn(page)
    await page.goto(`/w/${ws.slug}/connections`)
    await page.getByLabel('Name', { exact: true }).fill('resend-transactional')
    await page.getByRole('button', { name: 'Create the connection' }).click()
    await expect(page.getByTestId('secret-value')).toContainText('msk_')
    await page.screenshot({ path: `${dir}/connections-created-${theme}.png`, fullPage: true })

    await page.getByRole('link', { name: '+ New connection' }).click()
    await page.getByRole('radio', { name: 'SMTP' }).click()
    await page.screenshot({ path: `${dir}/connections-new-smtp-${theme}.png`, fullPage: true })

    await page.reload()
    await page.getByRole('link', { name: /resend-transactional/ }).click()
    await expect(page.getByTestId('env-snippet')).toContainText('RESEND_API_KEY=msk_')
    await page.screenshot({ path: `${dir}/connections-masked-${theme}.png`, fullPage: true })

    await page.goto('/')
    await page.getByRole('button', { name: 'New workspace' }).click()
    const dialog = page.getByRole('dialog', { name: 'New persistent workspace' })
    await dialog.getByLabel('Name').fill('Billing Service Staging')
    await dialog.getByRole('switch', { name: 'Add a first connection' }).click()
    await page.screenshot({ path: `${dir}/new-workspace-${theme}.png` })
  })
}
