import { randomUUID } from 'node:crypto'
import { createWorkspace } from './recipe/fixtures'
import { startReceiver } from './settings-fixtures'
import { expect, signIn, test } from './ui/fixtures'
import { BASE_URL } from './web-server'

// Follow-ups of the second UI wave (#112) and the demo messages (#62) on the built server:
// demo set through the Capture API and the empty inbox button (EN and FR), live suppression
// list with its total, creator in the ephemeral banner, deep links into the logs, « More
// filters », response headers, the mobile log table, and the settings / connection links.

const demoName = () => `fin ${randomUUID().slice(0, 8)}`

test('seeds the demo set, keeps the suppression list live and links to the logs', async ({
  page,
  playwright,
  admin,
}) => {
  test.slow()
  const name = demoName()
  const ws = await createWorkspace(playwright, admin, name)
  const slug = (await (await admin.get(`/admin/workspaces/${ws.id}`)).json()).slug
  const receiver = await startReceiver()
  const hook = await ws.capture.post('/capture/webhooks', {
    data: { connectionId: null, url: receiver.url, events: ['email.delivered'] },
  })
  expect(hook.status(), await hook.text()).toBe(201)

  await signIn(page)
  await page.goto(`/w/${slug}`)
  const banner = page.getByRole('region', { name: 'Ephemeral workspace' })
  await expect(banner).toContainText(`created by playwright · ${name}`)
  await expect(page.getByRole('button', { name: 'Load demo messages' })).toBeVisible()

  await page.goto(`/w/${slug}/suppressions`)
  await expect(page.getByTestId('suppression-total')).toHaveText('0 addresses')
  const seeded = await ws.capture.post('/capture/demo', { data: { locale: 'en' } })
  expect(seeded.status(), await seeded.text()).toBe(201)
  // No reload: hard bounce and complaint frames refetch the list.
  await expect(page.getByTestId('suppression-total')).toHaveText('2 addresses', {
    timeout: 20_000,
  })
  const rows = page.getByRole('row').filter({ hasText: '@' })
  await expect(rows.filter({ hasText: 'no-such-user@bounce.example.test' })).toContainText(name)

  const { messageIds } = await seeded.json()
  await page.goto(`/w/${slug}?m=${messageIds[0]}&tab=history`)
  await expect(page.getByRole('list', { name: 'Messages' }).getByRole('link')).toHaveCount(8)
  await expect(page.getByRole('link', { name: 'email.delivered' })).toBeVisible({
    timeout: 20_000,
  })
  await page.getByRole('link', { name: 'See in the logs explorer →' }).click()
  await expect(page).toHaveURL(new RegExp(`tab=webhooks.*messageId=${messageIds[0]}`))
  const table = page.getByRole('table', { name: 'Webhook deliveries' })
  await expect(table.getByRole('row').filter({ hasText: 'email.delivered' })).toHaveCount(1)
  await expect(page.getByRole('button', { name: /More filters/ })).toContainText('1')

  await receiver.close()
  await ws.dispose()
})

test('loads the demo set in the UI locale from the empty inbox', async ({ page, workspace }) => {
  const ws = await workspace()
  await signIn(page)
  await page.context().addCookies([{ name: 'mailsink_locale', value: 'fr', url: BASE_URL }])
  await page.goto(`/w/${ws.slug}`)
  await page.getByRole('button', { name: 'Charger des messages de démo' }).click()
  const list = page.getByRole('list', { name: 'Messages' })
  await expect(list.getByRole('link')).toHaveCount(8)
  await expect(list).toContainText('Votre facture INV-2026-0142')
})

test('logs: response headers, more filters and the phone layout', async ({
  page,
  playwright,
  admin,
}) => {
  const ws = await createWorkspace(playwright, admin, demoName())
  const slug = (await (await admin.get(`/admin/workspaces/${ws.id}`)).json()).slug
  const ingest = await playwright.request.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { authorization: `Bearer ${ws.connectionKey}` },
  })
  const send = async (subject: string) =>
    (
      await (
        await ingest.post('/v1/emails', {
          data: { from: 'app@example.test', to: 'qa@example.test', subject, text: 'hi' },
        })
      ).json()
    ).id as string
  const first = await send('First')
  await send('Second')

  await signIn(page)
  await page.goto(`/w/${slug}/logs`)
  const table = page.getByRole('table', { name: 'API calls' })
  await expect(table.getByRole('row').filter({ hasText: 'POST /v1/emails' })).toHaveCount(2)
  await page.getByRole('button', { name: /More filters/ }).click()
  const form = page.getByRole('form', { name: 'More filters' })
  await form.getByLabel('Message id').fill('req_nope')
  await form.getByRole('button', { name: 'Apply' }).click()
  await expect(form.getByText('A message id starts with msg_.')).toBeVisible()
  await form.getByLabel('Message id').fill(first)
  await form.getByRole('button', { name: 'Apply' }).click()
  await expect(page).toHaveURL(new RegExp(`messageId=${first}`))
  await expect(table.getByRole('row').filter({ hasText: 'POST /v1/emails' })).toHaveCount(1)
  await table.getByRole('row').filter({ hasText: 'POST /v1/emails' }).click()
  const headers = page.getByRole('dialog').getByLabel('Response headers')
  await expect(headers).toContainText('x-request-id')
  await expect(headers).toContainText('content-type')

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`/w/${slug}/logs`)
  await expect(table.getByRole('columnheader', { name: 'Action' })).toBeVisible()
  await expect(table.getByRole('columnheader', { name: 'Type' })).toHaveCount(0)
  const overflow = await table.evaluate(
    (el) => el.scrollWidth - (el.parentElement?.clientWidth ?? 0),
  )
  expect(overflow).toBeLessThanOrEqual(1)
  await expect(table.getByRole('row', { name: /^POST \/v1\/emails 200$/ })).toHaveCount(2)

  await ingest.dispose()
  await ws.dispose()
})

test('settings link the suppression list and the connection panel lists its webhooks', async ({
  page,
  workspace,
  admin,
}) => {
  const ws = await workspace()
  const created = await admin.post(`/admin/workspaces/${ws.id}/connections`, {
    data: { kind: 'resend', name: 'resend-main' },
  })
  expect(created.status()).toBe(201)
  await signIn(page)
  await page.goto(`/w/${ws.slug}/settings?section=retention`)
  await expect(page.getByRole('link', { name: 'Retention & suppression' })).toHaveAttribute(
    'aria-current',
    'page',
  )
  await page.getByRole('link', { name: 'Manage the suppression list →' }).click()
  await expect(page).toHaveURL(`/w/${ws.slug}/suppressions`)
  await expect(page.getByRole('heading', { name: 'Suppression list' })).toBeVisible()

  await page.goto(`/w/${ws.slug}/connections`)
  const panel = page.getByTestId('connection-panel')
  await expect(panel.getByRole('heading', { name: 'Active webhooks (0)' })).toBeVisible()
  await panel.getByRole('link', { name: 'Manage / Add a webhook →' }).click()
  await expect(page).toHaveURL(`/w/${ws.slug}/settings?section=webhooks`)
  await expect(page.getByRole('link', { name: 'Logs', exact: false }).first()).toHaveAttribute(
    'href',
    `/w/${ws.slug}/logs`,
  )
})

// Light and dark desktop captures for the PR (E2E_SCREENSHOTS=<dir>), skipped otherwise.
test('screenshots of the follow-ups', async ({ page, playwright, admin }) => {
  const dir = process.env.E2E_SCREENSHOTS
  test.skip(!dir, 'E2E_SCREENSHOTS not set')
  test.slow()
  const ws = await createWorkspace(playwright, admin, 'ci-run-8841-w3')
  const slug = (await (await admin.get(`/admin/workspaces/${ws.id}`)).json()).slug
  await page.setViewportSize({ width: 1440, height: 900 })
  await signIn(page)
  for (const theme of ['light', 'dark']) {
    await page.context().addCookies([{ name: 'mailsink_theme', value: theme, url: BASE_URL }])
    if (theme === 'light') {
      await page.goto(`/w/${slug}`)
      await expect(page.getByRole('button', { name: 'Load demo messages' })).toBeVisible()
      await page.screenshot({ path: `${dir}/empty-inbox-demo-${theme}.png` })
      await page.getByRole('button', { name: 'Load demo messages' }).click()
      await expect(page.getByRole('list', { name: 'Messages' }).getByRole('link')).toHaveCount(8)
      await page.waitForTimeout(1500) // statuses land
    }
    await page.goto(`/w/${slug}`)
    await page
      .getByRole('list', { name: 'Messages' })
      .getByText(/Your invoice/)
      .first()
      .click()
    await page.screenshot({ path: `${dir}/inbox-demo-${theme}.png` })
    await page.goto(`/w/${slug}/suppressions`)
    await expect(page.getByTestId('suppression-total')).toHaveText('2 addresses')
    await page.screenshot({ path: `${dir}/suppressions-${theme}.png` })
    await page.goto(`/w/${slug}/settings?section=retention`)
    await page.screenshot({ path: `${dir}/settings-retention-suppression-${theme}.png` })
    await page.goto(`/w/${slug}/connections`)
    await page.screenshot({ path: `${dir}/connection-webhooks-${theme}.png` })
    await page.goto(`/w/${slug}/logs?tab=webhooks`)
    await page.getByRole('button', { name: /More filters/ }).click()
    await page.waitForTimeout(300)
    await page.screenshot({ path: `${dir}/logs-more-filters-${theme}.png` })
  }
  await ws.dispose()
})
