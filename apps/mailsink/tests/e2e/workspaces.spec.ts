import { randomUUID } from 'node:crypto'
import { gotoHydrated } from './goto-hydrated'
import { expect, signIn, test } from './ui/fixtures'
import { deleteWorkspace } from './workspace-api'

// Workspace and connection management (#38): « New workspace » of the picker, the
// connections page (create, secrets shown once, rotation, enable / disable, delete), and
// editing / deleting the workspace. Every call goes through server functions: the browser
// never sends the admin key.

test.use({ permissions: ['clipboard-read', 'clipboard-write'] })

test('creates a persistent workspace with a first connection from the picker', async ({
  page,
  admin,
}) => {
  const slug = `ui-new-${randomUUID().slice(0, 8)}`
  await signIn(page)
  await gotoHydrated(page, '/')
  await page.getByRole('button', { name: 'New workspace' }).click()

  const dialog = page.getByRole('dialog', { name: 'New persistent workspace' })
  await dialog.getByLabel('Name').fill('QA Staging')
  await expect(dialog.getByLabel('Slug')).toHaveValue('qa-staging')
  await dialog.getByLabel('Slug').fill(slug)
  await dialog.getByRole('radio', { name: '24h' }).click()
  await dialog.getByLabel('Default rate limit').fill('10')
  await dialog.getByRole('switch', { name: 'Add a first connection' }).click()
  await dialog.getByRole('radio', { name: 'SMTP' }).click()
  await dialog.getByRole('button', { name: 'Create the workspace' }).click()

  const created = page.getByRole('dialog', { name: `Workspace ${slug} created` })
  await expect(created.getByTestId('workspace-key')).toContainText('mskw_')
  await expect(created.getByTestId('env-snippet')).toContainText('SMTP_PASS=')
  await created.getByRole('button', { name: 'Copy the workspace key' }).click()
  const clipboard = await page.evaluate(() => navigator.clipboard.readText())
  expect(clipboard).toMatch(/^mskw_/)
  await created.getByRole('button', { name: 'Open its connections' }).click()

  await expect(page).toHaveURL(`/w/${slug}/connections`)
  await expect(page.getByTestId('workspace-retention')).toHaveText('24h')
  await expect(page.getByTestId('workspace-rate-limit')).toHaveText('10 req/s')
  // Secrets are not shown again: the page only has the masked snippet.
  await expect(page.getByTestId('env-snippet')).toContainText('SMTP_PASS=••••')

  const detail = await (await admin.get(`/admin/workspaces/${slug}`)).json()
  expect(detail).toMatchObject({ ephemeral: false, retentionSeconds: 86_400 })
  expect(detail.connections).toHaveLength(1)
  await deleteWorkspace(admin, slug)
})

test('the header picker opens the creation dialog too', async ({ page, workspace }) => {
  const ws = await workspace()
  await signIn(page)
  await gotoHydrated(page, `/w/${ws.slug}`)
  await page
    .getByRole('banner')
    .getByRole('button', { name: `Workspace: ${ws.slug}` })
    .click()
  await page.getByRole('button', { name: 'New workspace' }).click()
  const dialog = page.getByRole('dialog', { name: 'New persistent workspace' })
  await expect(dialog.getByLabel('Name')).toBeFocused()
  await dialog.getByLabel('Name').fill('From the header')
  await expect(dialog.getByLabel('Slug')).toHaveValue('from-the-header')
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).toHaveCount(0)
})

test('a taken slug is reported on its field', async ({ page, workspace }) => {
  const taken = await workspace()
  await signIn(page)
  await gotoHydrated(page, '/')
  await page.getByRole('button', { name: 'New workspace' }).click()
  const dialog = page.getByRole('dialog', { name: 'New persistent workspace' })
  await dialog.getByLabel('Name').fill('Duplicate')
  await dialog.getByLabel('Slug').fill(taken.slug)
  await dialog.getByRole('button', { name: 'Create the workspace' }).click()
  await expect(dialog.getByText('This slug is already taken.')).toBeVisible()
})

test('manages the connections of a workspace', async ({ page, admin, workspace }) => {
  const ws = await workspace()
  await signIn(page)
  await gotoHydrated(page, `/w/${ws.slug}/connections`)

  // No connection yet: the creation form is open; SMTP shows its username field.
  await page.getByRole('radio', { name: 'SMTP' }).click()
  await expect(page.getByLabel('SMTP username')).toBeVisible()
  await page.getByRole('radio', { name: 'Resend' }).click()
  await expect(page.getByLabel('SMTP username')).toHaveCount(0)
  await page.getByLabel('Name', { exact: true }).fill('resend-transactional')
  await page.getByRole('button', { name: 'Create the connection' }).click()

  const panel = page.getByTestId('connection-panel')
  const secret = panel.getByTestId('secret-value')
  await expect(secret).toContainText('msk_')
  const firstKey = (await secret.textContent()) ?? ''
  await expect(panel.getByTestId('env-snippet')).toContainText(`RESEND_API_KEY=${firstKey}`)

  // Rotation: a new key is shown, the first one no longer authenticates.
  await panel.getByRole('button', { name: '↻ Rotate' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Rotate' }).click()
  await expect(secret).not.toHaveText(firstKey)
  const send = (key: string) =>
    page.request.post('/emails', {
      headers: { authorization: `Bearer ${key}` },
      data: { from: 'a@example.com', to: 'b@example.com', subject: 'hi', text: 'hi' },
    })
  expect((await send(firstKey)).status()).toBe(401)
  const secondKey = (await secret.textContent()) ?? ''
  expect((await send(secondKey)).status()).toBe(200)

  // Disable, then enable again.
  await panel.getByRole('switch').click()
  await expect(panel.getByText('Disabled', { exact: true })).toBeVisible()
  expect((await send(secondKey)).status()).toBe(403)
  await panel.getByRole('switch').click()
  await expect(panel.getByText('Enabled', { exact: true })).toBeVisible()

  // After a reload the secret is gone for good.
  await page.reload()
  await expect(panel.getByTestId('secret-value')).toHaveCount(0)
  await panel.getByRole('button', { name: 'Delete the connection' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByText('No connection yet', { exact: false })).toBeVisible()
  const detail = await (await admin.get(`/admin/workspaces/${ws.id}`)).json()
  expect(detail.connections).toEqual([])
})

test('edits then deletes a workspace, ephemeral included', async ({ page, admin, workspace }) => {
  const ws = await workspace({ ephemeral: true })
  await signIn(page)
  await gotoHydrated(page, `/w/${ws.slug}/connections`)

  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  const edit = page.getByRole('dialog', { name: 'Edit the workspace' })
  await edit.getByLabel('Name').fill('Renamed workspace')
  // The defaults have one place, the settings page (#112).
  await expect(edit.getByRole('radio', { name: '30d' })).toHaveCount(0)
  await expect(edit.getByRole('link', { name: 'edit them in the settings' })).toHaveAttribute(
    'href',
    `/w/${ws.slug}/settings?section=retention`,
  )
  await edit.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('heading', { name: 'Renamed workspace', level: 2 })).toBeVisible()

  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  const confirm = page.getByRole('alertdialog')
  const button = confirm.getByRole('button', { name: 'Delete the workspace' })
  await expect(button).toBeDisabled()
  await confirm.getByLabel('Type the slug to confirm').fill(ws.slug)
  await button.click()
  await expect(page).toHaveURL('/')
  expect((await admin.get(`/admin/workspaces/${ws.id}`)).status()).toBe(404)
})
