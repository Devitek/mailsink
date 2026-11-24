// Real answers of a representative set of routes checked against the OpenAPI registry
// (`@mailsink/openapi`): the status is one the document declares for the operation, and a
// JSON body matches the declared schema exactly (no undocumented field, D262).
import { describeDb } from '@mailsink/db/testing'
import { expect, it } from 'vitest'
import { createMailsink, type Mailsink } from '../src'
import { useHarness } from './harness'
import { checkExchanges, type Exchange, recordingFetch, routeOf } from './openapi-check'

/** A client of the same options whose answers are recorded in `log`. */
function recording(client: Mailsink, log: Exchange[]): Mailsink {
  return createMailsink({ ...client.options, fetch: recordingFetch(log) })
}

describeDb('OpenAPI response schemas', (ctx) => {
  const h = useHarness(ctx)

  it('answers what the registry declares on admin, capture, webhook and log routes', async () => {
    const log: Exchange[] = []
    const admin = recording(h.admin, log)
    const sink = recording(h.sink, log)
    const id = await h.send({ to: 'schema@example.com', subject: 'Schema check' })

    await admin.admin.workspaces.list({ includeEphemeral: true })
    await admin.admin.workspaces.get(h.workspaceId)
    await admin.admin.workspaces.update(h.workspaceId, { description: 'Checked' })
    const template = await admin.admin.templates.create(h.workspaceId, {
      name: 'Acme welcome',
      subject: 'Welcome',
      html: '<p>Welcome</p>',
    })
    await admin.admin.templates.list(h.workspaceId)
    await admin.admin.templates.delete(h.workspaceId, template.externalId)
    await admin.admin.logs.list()

    await sink.messages.list()
    await sink.messages.get(id)
    await sink.messages.waitFor({ to: 'schema@example.com' }, { since: new Date(0) })
    await sink.messages.triggerEvent(id, { type: 'status', status: 'delivered' })
    await sink.overrides.activate({ rules: [{ match: 'x@example.com', status: 'failed' }] })
    await sink.overrides.get()
    await sink.overrides.reset()
    await sink.suppressions.list()
    const endpoint = await sink.webhooks.create({
      connectionId: null,
      url: `${h.server.url}/hook`,
      events: ['email.delivered'],
    })
    await sink.webhooks.list()
    await sink.webhooks.preview({ payloadFormat: 'resend', event: 'email.delivered' })
    const delivery = await sink.webhooks.test(endpoint.id)
    await sink.webhooks.deliveries.list()
    await sink.webhooks.deliveries.get(delivery.id)
    await sink.webhooks.delete(endpoint.id)
    await sink.logs.api.list()
    await sink.logs.smtp.list()
    await sink.messages.get('msg_unknown').catch(() => undefined)
    await admin.admin.workspaces.create({ name: '' }).catch(() => undefined)
    await sink.messages.purge()

    const failures = checkExchanges(log)
    expect(failures).toEqual([])
    const covered = new Set(log.map((e) => `${e.method} ${routeOf(e.method, e.path).path}`))
    expect(covered.size).toBeGreaterThanOrEqual(25)
    expect(log.some((e) => e.status === 404) && log.some((e) => e.status === 422)).toBe(true)
  })
})
