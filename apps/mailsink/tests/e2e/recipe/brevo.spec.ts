import { BrevoClient } from '@getbrevo/brevo'
import { expect, test } from '@playwright/test'
import { BASE_URL } from '../web-server'
import { adminContext } from './fixtures'

// docs/guides/e2e.md, « Sending with the Brevo SDK »: a `brevo` connection seeded with the
// templates of the app, the official SDK pointed at Mailsink, assertions with wait=true.

const templates = [
  {
    externalId: 12,
    name: 'Reset',
    subject: 'Reset for {{ params.name }}',
    html: '<p>Hi {{ params.name }}, <a href="{{ params.url }}">reset</a></p>',
    sender: { email: 'support@app.test', name: 'Support' },
  },
]

test('the Brevo SDK sends a template, captured rendered with its links', async ({
  playwright,
}, testInfo) => {
  const admin = await adminContext(playwright)
  const created = await admin.post('/admin/workspaces', {
    data: {
      name: `e2e-brevo-${testInfo.workerIndex}`,
      ephemeral: true,
      idleTtlSeconds: 600,
      connections: [{ kind: 'brevo', name: 'app' }],
      templates,
    },
  })
  expect(created.status()).toBe(201)
  const body = await created.json()
  const { apiKey, baseUrl } = body.connections[0].credentials
  expect(baseUrl).toBe(`${BASE_URL}/v3`)
  const capture = await playwright.request.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { authorization: `Bearer ${body.workspaceKey}` },
  })
  try {
    // What the application does, unchanged but for its two environment variables.
    const brevo = new BrevoClient({ apiKey, baseUrl, maxRetries: 0 })
    const since = new Date().toISOString()
    const sent = await brevo.transactionalEmails.sendTransacEmail({
      templateId: 12,
      to: [{ email: 'jane@example.com' }],
      params: { name: 'Jane', url: 'https://app.test/reset?t=1' },
    })
    expect(sent.messageId).toMatch(/^<.+@.+>$/)

    const res = await capture.get('/capture/messages', {
      params: { wait: true, since, to: 'jane@example.com', status: 'delivered', timeout: 10_000 },
    })
    const [message] = (await res.json()).data
    expect(message).toMatchObject({ subject: 'Reset for Jane', source: 'brevo' })
    const detail = await (await capture.get(`/capture/messages/${message.id}`)).json()
    expect(detail.links.map((l: { url: string }) => l.url)).toEqual(['https://app.test/reset?t=1'])
    expect(detail.from).toMatchObject({ email: 'support@app.test' })
  } finally {
    await capture.dispose()
    await admin.delete(`/admin/workspaces/${body.workspace.id}`)
    await admin.dispose()
  }
})
