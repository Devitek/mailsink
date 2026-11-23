import { ResendWebhookPayload, WebhookEndpointInput } from '@mailsink/contracts'
import { createTestConnection, createTestWorkspace, describeDb } from '@mailsink/db/testing'
import { Webhook } from 'svix'
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest'
import { createWebhookEndpoint } from './endpoints'
import { previewWebhook, sendTestWebhook } from './sample-send'
import { headerRecord, startTestReceiver, type TestReceiver } from './testing/receiver'

describeDb('webhook preview and test send', (ctx) => {
  let receiver: TestReceiver
  let ws = ''
  beforeAll(async () => {
    receiver = await startTestReceiver()
  })
  afterAll(() => receiver.close())
  beforeEach(async () => {
    ws = (await createTestWorkspace(ctx.db, { timezone: 'Europe/Paris' })).id
    receiver.received.length = 0
    receiver.respondWith(200)
  })

  it('previews the real formatter output with masked secrets', async () => {
    const con = await createTestConnection(ctx.db, ws)
    const resend = await previewWebhook(ctx.db, ws, {
      payloadFormat: 'resend',
      event: 'email.delivery_delayed',
      connectionId: con.id,
    })
    expect(ResendWebhookPayload.parse(JSON.parse(resend.body)).type).toBe('email.delivery_delayed')
    expect(resend.headers['svix-signature']).toBe('v1,••••••••')
    const brevo = await previewWebhook(ctx.db, ws, { payloadFormat: 'brevo', event: 'hardBounce' })
    expect(JSON.parse(brevo.body)).toMatchObject({
      event: 'hard_bounce',
      reason: expect.any(String),
    })
    await expect(
      previewWebhook(ctx.db, ws, { payloadFormat: 'brevo', event: 'email.failed' }),
    ).rejects.toMatchObject({ code: 'validation_error' })
  })

  it('sends one signed sample event, logged as a delivery without retry', async () => {
    const endpoint = await createWebhookEndpoint(
      ctx.db,
      ws,
      WebhookEndpointInput.parse({
        connectionId: null,
        url: receiver.url,
        payloadFormat: 'resend',
        events: ['email.delivered'],
      }),
    )
    const ok = await sendTestWebhook(ctx.db, ws, endpoint.id, 'email.bounced')
    expect(ok).toMatchObject({
      status: 'succeeded',
      messageId: null,
      eventId: null,
      dialectEvent: 'email.bounced',
      attempts: [{ attemptNo: 1, responseStatus: 200 }],
    })
    const [req] = receiver.received
    expect(() =>
      new Webhook(endpoint.secret ?? '').verify(req?.body ?? '', headerRecord(req?.headers ?? {})),
    ).not.toThrow()
    receiver.respondWith(500)
    const failed = await sendTestWebhook(ctx.db, ws, endpoint.id, undefined)
    expect(failed).toMatchObject({
      status: 'failed',
      canonicalEvent: 'email.delivered',
      nextAttemptAt: null,
    })
  })
})
