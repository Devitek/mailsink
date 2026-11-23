import { SendEmailRequest, WebhookEndpointInput } from '@mailsink/contracts'
import { jobs, webhookDeliveries } from '@mailsink/db'
import { createTestSuppression, describeDb } from '@mailsink/db/testing'
import { eq } from 'drizzle-orm'
import { beforeEach, expect, it } from 'vitest'
import { createEventBus, type StreamFrame } from '../events/bus'
import { createWebhookEndpoint } from '../webhooks/endpoints'
import { sendNativeEmail } from './native'
import type { IngestTarget } from './normalize'
import { sampleRequest, seedTarget } from './testing/fixtures'

describeDb('ingestion webhook fan-out', (ctx) => {
  let target: IngestTarget
  const bus = createEventBus()
  const frames: StreamFrame[] = []

  beforeEach(async () => {
    target = await seedTarget(ctx.db)
    frames.length = 0
    bus.subscribe(target.workspaceId, (f) => frames.push(f))
  })

  const endpoint = (patch: Record<string, unknown>) =>
    createWebhookEndpoint(
      ctx.db,
      target.workspaceId,
      WebhookEndpointInput.parse({ connectionId: null, url: 'https://hooks.example/x', ...patch }),
    )
  const send = (to: string[]) =>
    sendNativeEmail(
      { db: ctx.db, maxMessageBytes: 64 * 1024, bus },
      target,
      SendEmailRequest.parse(sampleRequest({ to })),
    )

  it('emits email.suppressed for each suppressed recipient, committed with the message', async () => {
    const unified = await endpoint({ events: ['email.suppressed', 'email.sent'] })
    const brevo = await endpoint({ payloadFormat: 'brevo', events: ['blocked'] })
    await endpoint({ payloadFormat: 'resend', events: ['email.sent'] }) // no Resend name
    await createTestSuppression(ctx.db, target.workspaceId, 'gone@x.io')

    const body = (await send(['gone@x.io', 'ok@x.io'])).response.body as { id: string }
    const rows = await ctx.db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.messageId, body.id))
    expect(rows.map((r) => [r.endpointId, r.dialectEvent, r.recipient]).sort()).toEqual(
      [
        [unified.id, 'email.suppressed', 'gone@x.io'],
        [brevo.id, 'blocked', 'gone@x.io'],
      ].sort(),
    )
    const queued = await ctx.db.select().from(jobs).where(eq(jobs.kind, 'deliver_webhook'))
    const ids = queued.map((j) => (j.payload as { deliveryId: string }).deliveryId)
    expect(ids).toEqual(expect.arrayContaining(rows.map((r) => r.id)))
    expect(frames.filter((f) => f.event.type === 'webhook.delivery')).toHaveLength(2)
  })

  it('creates no delivery when nobody is suppressed', async () => {
    await endpoint({ events: ['email.suppressed'] })
    const body = (await send(['fine@x.io'])).response.body as { id: string }
    const rows = await ctx.db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.messageId, body.id))
    expect(rows).toEqual([])
  })
})
