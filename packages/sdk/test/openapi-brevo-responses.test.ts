// The Brevo read routes (#149, #153) checked against the OpenAPI registry like the others
// (D262): answers of `GET /v3/smtp/emails`, `GET /v3/smtp/blockedContacts` and
// `DELETE /v3/smtp/blockedContacts/{email}`, successes and Brevo errors.
import { describeDb } from '@mailsink/db/testing'
import { expect, it } from 'vitest'
import { useHarness } from './harness'
import { checkExchanges, type Exchange, recordingFetch, routeOf } from './openapi-check'

describeDb('OpenAPI response schemas, Brevo read routes', (ctx) => {
  const h = useHarness(ctx)

  it('answers what the registry declares', async () => {
    const created = await h.admin.admin.connections.create(h.workspaceId, {
      kind: 'brevo',
      name: 'Brevo',
    })
    const { credentials } = created
    if (credentials.kind !== 'brevo') throw new Error('no brevo connection')
    const log: Exchange[] = []
    const record = recordingFetch(log)
    const brevo = (path: string, init: RequestInit = {}) =>
      record(`${h.server.url}${path}`, {
        ...init,
        headers: { 'api-key': credentials.apiKey, 'content-type': 'application/json' },
      })
    const email = 'reader@example.com'

    await brevo('/v3/smtp/email', {
      method: 'POST',
      body: JSON.stringify({
        sender: { email: 'app@example.com', name: 'Acme' },
        to: [{ email }],
        subject: 'Brevo schema check',
        textContent: 'Hello',
      }),
    })
    await brevo(`/v3/smtp/emails?email=${encodeURIComponent(email)}`)
    await brevo('/v3/smtp/emails')
    const [message] = (await h.sink.messages.list({ to: email })).data
    if (!message) throw new Error(`message not captured: ${JSON.stringify(log)}`)
    await h.sink.messages.triggerEvent(message.id, { type: 'status', status: 'hard_bounce' })
    await brevo('/v3/smtp/blockedContacts?limit=10')
    await brevo('/v3/smtp/blockedContacts?limit=1000')
    await brevo(`/v3/smtp/blockedContacts/${encodeURIComponent(email)}`, { method: 'DELETE' })
    await brevo(`/v3/smtp/blockedContacts/${encodeURIComponent(email)}`, { method: 'DELETE' })

    expect(checkExchanges(log)).toEqual([])
    const reads = log.filter((e) => routeOf(e.method, e.path).path !== '/v3/smtp/email')
    expect(reads.map((e) => `${e.method} ${e.status}`)).toEqual([
      'get 200',
      'get 400',
      'get 200',
      'get 400',
      'delete 204',
      'delete 404',
    ])
    const page = reads[2]?.body as { contacts: { email: string }[] }
    expect(page.contacts.map((c) => c.email)).toEqual([email])
  })
})
