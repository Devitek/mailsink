import { expect, openSettings, startReceiver, test } from './settings-fixtures'
import { signIn } from './ui/fixtures'

// Workspace settings (#43): defaults, webhook endpoints, Brevo templates and MCP snippets,
// through the UI session only.

test('saves the retention quota and the default simulation', async ({
  page,
  admin,
  settingsWorkspace: ws,
}) => {
  await signIn(page)
  await openSettings(page, ws.slug, 'retention')
  await page.getByRole('radio', { name: '24h' }).click()
  await page.getByLabel('Maximum messages').fill('500')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Saved.')).toBeVisible()

  await page.getByRole('link', { name: 'Simulation & rate limit' }).click()
  await page.getByLabel('hard_bounce').fill('10')
  await expect(page.getByTestId('delivered-share')).toHaveText('90 %')
  await page.getByLabel('Opened').fill('40')
  await page.getByLabel('Requests').fill('20')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Saved.')).toBeVisible()

  const view = await (await admin.get(`/admin/workspaces/${ws.id}`)).json()
  expect(view).toMatchObject({
    retentionSeconds: 86_400,
    maxMessages: 500,
    rateLimit: { limit: 20, windowSeconds: 1 },
    simulation: { rates: { hard_bounce: 10 }, openRate: 40 },
  })
})

test('creates a webhook endpoint, previews it, test-sends and deletes it', async ({
  page,
  settingsWorkspace: ws,
}) => {
  const receiver = await startReceiver()
  try {
    await signIn(page)
    await openSettings(page, ws.slug, 'webhooks')
    await page.getByRole('button', { name: '+ Add an endpoint' }).click()
    const dialog = page.getByRole('dialog', { name: 'New webhook endpoint' })

    // The scope prefills the format until it is picked by hand.
    await dialog.getByRole('combobox', { name: 'Scope' }).click()
    await page.getByRole('option', { name: /resend-main/ }).click()
    await expect(dialog.getByRole('radio', { name: 'Resend' })).toBeChecked()
    await expect(dialog.getByRole('button', { name: 'Event email.delivered' })).toBeVisible()
    await expect(dialog.getByTestId('preview-headers')).toContainText('svix-signature')
    await dialog.getByRole('radio', { name: 'Brevo' }).click()
    await expect(dialog.getByText('Authentication sent by Brevo')).toBeVisible()
    await dialog.getByRole('combobox', { name: 'Scope' }).click()
    await page.getByRole('option', { name: /Workspace/ }).click()
    await expect(dialog.getByRole('radio', { name: 'Brevo' })).toBeChecked()

    // An event the chosen format cannot send is kept and reported.
    await dialog.getByRole('radio', { name: 'Unified' }).click()
    await dialog.getByRole('button', { name: 'Event email.failed' }).click()
    await dialog.getByRole('radio', { name: 'Brevo' }).click()
    await expect(dialog.getByText(/never sent/)).toContainText('email.failed')
    await dialog.getByRole('radio', { name: 'Unified' }).click()
    await expect(dialog.getByTestId('preview-headers')).toContainText('X-Mailsink-Signature')

    await dialog.getByLabel('URL').fill(receiver.url)
    await dialog.getByRole('button', { name: 'Create the endpoint' }).click()
    await expect(dialog).toBeHidden()

    const card = page.getByTestId('webhook-endpoint')
    await expect(card.getByTestId('webhook-secret')).toContainText('whsec_')
    await card.getByRole('button', { name: 'Test send' }).click()
    await expect(card.getByTestId('test-send-result')).toContainText('200')
    expect(receiver.received.at(-1)?.headers['x-mailsink-signature']).toBeTruthy()

    await card.getByRole('switch', { name: 'Enabled' }).click()
    await expect(card.getByRole('button', { name: 'Test send' })).toBeDisabled()
    await card.getByRole('button', { name: 'Delete' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByText(/No webhook endpoint yet/)).toBeVisible()
  } finally {
    await receiver.close()
  }
})

test('edits Brevo templates with a rendered preview', async ({ page, settingsWorkspace: ws }) => {
  await signIn(page)
  await openSettings(page, ws.slug, 'templates')
  await page.getByRole('button', { name: '+ New template' }).click()
  const dialog = page.getByRole('dialog', { name: 'New Brevo template' })
  await dialog.getByLabel('ID').fill('42')
  await dialog.getByLabel('Name').fill('Welcome')
  await dialog.getByLabel('Subject').fill('Hi {{ params.name | upper }}')
  await dialog.getByLabel('HTML').fill('<p>Hello {{ params.name }}</p>')
  await expect(dialog.getByTestId('template-preview-subject')).toHaveText('Hi JULIE')
  await expect(
    dialog.frameLocator('iframe[title="Rendered HTML"]').getByText('Hello Julie'),
  ).toBeVisible()
  await dialog.getByRole('button', { name: 'Create the template' }).click()
  await expect(dialog).toBeHidden()

  const row = page.getByTestId('template-row')
  await expect(row).toContainText('Welcome')
  await row.getByRole('button', { name: 'Edit template 42' }).click()
  await page.getByRole('dialog').getByLabel('Name').fill('Welcome v2')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(row).toContainText('Welcome v2')
  await row.getByRole('button', { name: 'Delete template 42' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByText('No template yet.')).toBeVisible()
})

test('shows the MCP configuration of the workspace', async ({ page, settingsWorkspace: ws }) => {
  await signIn(page)
  await openSettings(page, ws.slug, 'mcp')
  await expect(page.getByTestId('mcp-endpoint')).toHaveText(/\/mcp$/)
  await expect(page.getByTestId('env-snippet').first()).toContainText('claude mcp add')
  await page.getByRole('radio', { name: 'Cursor' }).click()
  await expect(page.getByTestId('env-snippet').first()).toContainText('"mcpServers"')
})
