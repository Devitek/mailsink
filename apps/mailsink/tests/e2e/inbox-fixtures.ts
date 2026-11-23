import { randomUUID } from 'node:crypto'
import type { APIRequestContext } from '@playwright/test'
import { adminContext, deleteWorkspace } from './recipe/fixtures'
import { test as base, expect } from './ui/fixtures'
import { BASE_URL } from './web-server'

// Inbox scenarios (#39, #40): a workspace with one Resend connection whose key sends
// through the native API, as an application under test would, while the browser watches.

export type InboxWorkspace = {
  id: string
  slug: string
  /** POST /v1/emails with the connection key; returns the message id. */
  send: (email: Record<string, unknown>) => Promise<string>
}

export const test = base.extend<{ inbox: () => Promise<InboxWorkspace> }>({
  inbox: async ({ playwright }, use) => {
    const admin = await adminContext(playwright)
    const opened: { id: string; ingest: APIRequestContext }[] = []
    await use(async () => {
      const name = `inbox ${randomUUID().slice(0, 8)}`
      const res = await admin.post('/admin/workspaces', {
        data: { name, connections: [{ kind: 'resend', name: 'resend-main' }] },
      })
      expect(res.status(), await res.text()).toBe(201)
      const body = await res.json()
      const ingest = await playwright.request.newContext({
        baseURL: BASE_URL,
        extraHTTPHeaders: { authorization: `Bearer ${body.connections[0].credentials.apiKey}` },
      })
      opened.push({ id: body.workspace.id, ingest })
      return {
        id: body.workspace.id,
        slug: body.workspace.slug,
        async send(email) {
          const sent = await ingest.post('/v1/emails', { data: email })
          expect(sent.ok(), await sent.text()).toBe(true)
          return (await sent.json()).id
        },
      }
    })
    for (const { id, ingest } of opened) {
      await ingest.dispose()
      await deleteWorkspace(admin, id)
    }
    await admin.dispose()
  },
})

export const booking = {
  from: 'Acme Studio <no-reply@acme.test>',
  to: 'julie.martin@gmail.test',
  subject: 'Your class booking at 18:00 is confirmed',
  html: `<html><head><style>p { font-family: sans-serif }</style></head><body>
    <h1>See you tonight</h1><p>Coach Sam expects you at 18:00.</p>
    <p><a href="https://acme.test/bookings/4821">Manage my booking</a></p>
    <script>document.body.innerHTML = 'script ran'</script></body></html>`,
  text: 'See you tonight. Coach Sam expects you at 18:00.',
  tags: [
    { name: 'category', value: 'booking' },
    { name: 'env', value: 'staging' },
  ],
  attachments: [
    {
      filename: 'booking.ics',
      content: Buffer.from('BEGIN:VCALENDAR\nEND:VCALENDAR\n').toString('base64'),
    },
  ],
}

export { expect }
