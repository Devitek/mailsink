import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { APIRequestContext } from '@playwright/test'
import { createTransport } from 'nodemailer'
import { test as base, expect, signIn } from './ui/fixtures'
import { BASE_URL, SMTP_PORT } from './web-server'

// The logs explorer (#41) on the built server: API calls, SMTP-less workspace, webhook
// deliveries to a local receiver, the inspector sheet and the optimistic replay.

type LogsWorkspace = {
  slug: string
  capture: APIRequestContext
  send: (email: Record<string, unknown>) => Promise<number>
  /** One SMTP session of the smtp connection, sending `email`. */
  smtp: () => Promise<void>
  /** A local receiver and an endpoint of the workspace pointing at it. */
  endpoint: (data?: Record<string, unknown>) => Promise<string>
}

const email = {
  from: 'Acme Studio <no-reply@acme.test>',
  to: 'julie.martin@gmail.test',
  subject: 'Your class booking at 18:00 is confirmed',
  text: 'See you tonight.',
}

const test = base.extend<{ logs: () => Promise<LogsWorkspace> }>({
  logs: async ({ playwright, admin }, use) => {
    const cleanup: (() => Promise<unknown>)[] = []
    await use(async () => {
      const res = await admin.post('/admin/workspaces', {
        data: {
          name: `logs ${randomUUID().slice(0, 8)}`,
          connections: [
            { kind: 'resend', name: 'resend-main' },
            { kind: 'smtp', name: 'smtp-legacy' },
          ],
        },
      })
      expect(res.status(), await res.text()).toBe(201)
      const body = await res.json()
      const context = (key: string) =>
        playwright.request.newContext({
          baseURL: BASE_URL,
          extraHTTPHeaders: { authorization: `Bearer ${key}` },
        })
      const capture = await context(body.workspaceKey)
      const ingest = await context(body.connections[0].credentials.apiKey)
      cleanup.push(
        () => capture.dispose(),
        () => ingest.dispose(),
        () => admin.delete(`/admin/workspaces/${body.workspace.id}`),
      )
      return {
        slug: body.workspace.slug,
        capture,
        send: async (data) => (await ingest.post('/v1/emails', { data })).status(),
        async smtp() {
          const { smtpUser, smtpPass } = body.connections[1].credentials
          const transport = createTransport({
            host: '127.0.0.1',
            port: SMTP_PORT,
            secure: false,
            ignoreTLS: true,
            auth: { user: smtpUser, pass: smtpPass },
          })
          await transport.sendMail(email)
          transport.close()
        },
        async endpoint(data = {}) {
          const server = createServer((req, reply) => {
            req.resume().on('end', () => reply.writeHead(200).end('{"ok":true}'))
          })
          await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
          cleanup.push(() => new Promise((resolve) => server.close(resolve)))
          const { port } = server.address() as AddressInfo
          const created = await capture.post('/capture/webhooks', {
            data: {
              connectionId: null,
              url: `http://127.0.0.1:${port}/hooks`,
              events: ['email.delivered'],
              ...data,
            },
          })
          expect(created.status(), await created.text()).toBe(201)
          const { id } = await created.json()
          const sent = await capture.post(`/capture/webhooks/${id}/test`, { data: {} })
          expect(sent.ok(), await sent.text()).toBe(true)
          return id
        },
      }
    })
    for (const step of cleanup.reverse()) await step()
  },
})

test('API calls show live, filter through the URL and open in the inspector', async ({
  page,
  logs,
}) => {
  const ws = await logs()
  expect(await ws.send(email)).toBe(200)
  await signIn(page)
  await page.goto(`/w/${ws.slug}/logs`)
  await expect(page).toHaveTitle(/^Logs · Mailsink$/)
  const table = page.getByRole('table', { name: 'API calls' })
  await expect(table.getByRole('row').filter({ hasText: /POST \/v1\/emails/ })).toHaveCount(1)
  await expect(page.getByRole('status').filter({ hasText: 'SSE Live' })).toBeVisible()

  // A refused call made while the page is open arrives through the stream.
  expect(await ws.send({ ...email, to: 'not an address' })).toBe(422)
  await expect(table.getByRole('row').filter({ hasText: /POST \/v1\/emails/ })).toHaveCount(2)
  await expect(table.getByText('422 validation_error')).toBeVisible()

  await page.getByRole('group', { name: 'Filters' }).getByRole('button', { name: 'Status' }).click()
  await page.getByRole('checkbox', { name: /4xx/ }).check()
  await page.keyboard.press('Escape')
  await expect(page).toHaveURL(/code=/)
  await expect(table.getByRole('row').filter({ hasText: /POST/ })).toHaveCount(1)
  await page.reload()
  await expect(table.getByRole('row').filter({ hasText: /POST/ })).toHaveCount(1)

  await table.getByRole('row').filter({ hasText: /422/ }).click()
  await expect(page).toHaveURL(/inspect=req_/)
  const sheet = page.getByRole('dialog', { name: 'POST /v1/emails' })
  await expect(sheet.getByRole('heading', { name: 'Request' })).toBeVisible()
  await expect(sheet.getByText('"not an address"')).toBeVisible()
  await expect(sheet.getByText('"validation_error"').first()).toBeVisible()
  await sheet.getByRole('button', { name: 'Close' }).click()
  await expect(page).not.toHaveURL(/inspect=/)
})

test('webhook deliveries: signature, masked Authorization, optimistic replay', async ({
  page,
  logs,
}) => {
  const ws = await logs()
  await ws.endpoint()
  await ws.endpoint({ payloadFormat: 'brevo', brevoAuth: { type: 'bearer', token: 'tok-123' } })
  await signIn(page)
  await page.goto(`/w/${ws.slug}/logs?tab=webhooks`)
  const table = page.getByRole('table', { name: 'Webhook deliveries' })
  await expect(
    table.getByRole('row').filter({ hasText: /email\.delivered|delivered/ }),
  ).toHaveCount(2)

  await page
    .getByRole('group', { name: 'Filters' })
    .getByRole('button', { name: 'payloadFormat' })
    .click()
  await page.getByRole('checkbox', { name: 'brevo' }).check()
  await page.keyboard.press('Escape')
  await expect(page).toHaveURL(/format=brevo/)
  await expect(table.getByRole('row').filter({ hasText: /brevo/ })).toHaveCount(1)
  await table.getByRole('row').filter({ hasText: /brevo/ }).click()
  const sheet = page.getByRole('dialog')
  await expect(sheet.getByText('Bearer ••••••••')).toBeVisible()
  await expect(sheet.getByText('tok-123')).toHaveCount(0)
  await sheet.getByRole('button', { name: 'Show Authorization' }).click()
  await expect(sheet.getByText('Bearer tok-123')).toBeVisible()
  await sheet.getByRole('button', { name: 'Close' }).click()

  await page
    .getByRole('group', { name: 'Filters' })
    .getByRole('button', { name: /payloadFormat/ })
    .click()
  await page.getByRole('checkbox', { name: 'brevo' }).uncheck()
  await page.getByRole('checkbox', { name: 'unified' }).check()
  await page.keyboard.press('Escape')
  await table
    .getByRole('row')
    .filter({ hasText: /unified/ })
    .click()
  await expect(sheet.getByText('Signature valid with the secret whsec_')).toBeVisible()
  await expect(sheet.getByText('X-Mailsink-Signature')).toBeVisible()
  await sheet.getByRole('radio', { name: 'resign' }).click()
  await sheet.getByRole('button', { name: 'Replay the webhook' }).click()
  await expect(sheet.getByRole('status')).toContainText(/Replay queued as\s*whd_/)
  // The sheet is modal: the table behind it is hidden from the accessibility tree.
  await sheet.getByRole('button', { name: 'Close' }).click()
  await expect(table.getByRole('row').filter({ hasText: /replay resign/ })).toHaveCount(1)
  await expect(
    table.getByRole('row').filter({ hasText: /replay resign.*200 succeeded/ }),
  ).toBeVisible()
})

test('SMTP sessions with their outcome and the SMTP dialogue', async ({ page, logs }) => {
  const ws = await logs()
  await ws.smtp()
  await signIn(page)
  await page.goto(`/w/${ws.slug}/logs?tab=smtp`)
  const table = page.getByRole('table', { name: 'SMTP sessions' })
  const rows = table.getByRole('row').filter({ hasText: 'smtp-legacy' })
  await expect(rows).toHaveCount(1)
  // A second session arrives through the stream (log.smtp).
  await ws.smtp()
  await expect(rows).toHaveCount(2)

  const outcome = page.getByRole('group', { name: 'Filters' }).getByRole('button', {
    name: 'Outcome',
  })
  await outcome.click()
  await page.getByRole('checkbox', { name: 'rejected' }).check()
  await page.keyboard.press('Escape')
  await expect(page).toHaveURL(/outcome=/)
  await expect(table.getByText('No row matches these filters.')).toBeVisible()
  await outcome.click()
  await page.getByRole('button', { name: 'Clear filter' }).click()
  await page.keyboard.press('Escape')
  await expect(rows).toHaveCount(2)

  await rows.first().click()
  const sheet = page.getByRole('dialog')
  await expect(sheet.getByRole('heading', { name: 'SMTP dialogue' })).toBeVisible()
  await expect(sheet.getByText('AUTH PLAIN [redacted]')).toBeVisible()
  await expect(sheet.getByRole('link', { name: /^msg_/ })).toHaveCount(1)
})

// Light and dark desktop captures for the PR (E2E_SCREENSHOTS=<dir>), skipped otherwise.
test('screenshots of the logs explorer', async ({ page, logs }) => {
  const dir = process.env.E2E_SCREENSHOTS
  test.skip(!dir, 'E2E_SCREENSHOTS not set')
  const ws = await logs()
  await ws.send(email)
  await ws.send({ ...email, to: 'not an address' })
  await ws.send({ ...email, to: 'qa+reset@bounce.test', subject: 'Reset your password' })
  await ws.endpoint()
  await ws.smtp()
  await page.setViewportSize({ width: 1440, height: 900 })
  await signIn(page)
  for (const theme of ['light', 'dark']) {
    await page.context().addCookies([{ name: 'mailsink_theme', value: theme, url: BASE_URL }])
    await page.goto(`/w/${ws.slug}/logs`)
    await expect(page.getByRole('row').filter({ hasText: /POST \/v1/ })).toHaveCount(3)
    await page.screenshot({ path: `${dir}/logs-api-${theme}.png` })
    await page.getByRole('row').filter({ hasText: /422/ }).click()
    await expect(page.getByRole('heading', { name: 'Response' })).toBeVisible()
    await page.waitForTimeout(400) // the sheet slides in
    await page.screenshot({ path: `${dir}/logs-api-inspector-${theme}.png` })
    await page.goto(`/w/${ws.slug}/logs?tab=smtp`)
    await page.getByRole('row').filter({ hasText: 'smtp-legacy' }).click()
    await expect(page.getByRole('heading', { name: 'SMTP dialogue' })).toBeVisible()
    await page.waitForTimeout(400)
    await page.screenshot({ path: `${dir}/logs-smtp-inspector-${theme}.png` })
    await page.goto(`/w/${ws.slug}/logs?tab=webhooks`)
    await page
      .getByRole('row')
      .filter({ hasText: /unified/ })
      .last()
      .click()
    await expect(page.getByText(/Signature valid/)).toBeVisible()
    await page.waitForTimeout(400)
    await page.screenshot({ path: `${dir}/logs-webhook-inspector-${theme}.png` })
  }
})
