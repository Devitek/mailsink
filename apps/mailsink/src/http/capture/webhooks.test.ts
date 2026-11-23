import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { describeDb } from '@mailsink/db/testing'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { stopRuntime } from '../../runtime/boot'
import { postEmail } from '../native/emails'
import { installTestRuntime, request, seedWorkspace } from '../test-fixtures'
import { getMessage } from './api'
import { postMessageEventApi } from './events'
import {
  createWebhookApi,
  deleteWebhookApi,
  getWebhookApi,
  listWebhooksApi,
  patchWebhookApi,
  previewWebhookApi,
  testWebhookApi,
} from './webhooks'
import { getDeliveryApi, listDeliveriesApi, replayDeliveryApi } from './webhooks-deliveries'

describeDb('Webhook API over HTTP', (ctx) => {
  let a: Awaited<ReturnType<typeof seedWorkspace>>
  let hookUrl = ''
  let hits = 0
  const server = createServer((req, res) => {
    req.resume()
    req.on('end', () => {
      hits += 1
      res.writeHead(204).end()
    })
  })
  beforeAll(async () => {
    await installTestRuntime(ctx.handle)
    a = await seedWorkspace(ctx.db)
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    hookUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/hook`
  })
  afterAll(async () => {
    await stopRuntime()
    server.closeAllConnections()
    await new Promise((resolve) => server.close(resolve))
  })

  const call = (path: string, method: string, body?: unknown, bearer = a.workspaceKey) =>
    request(path, {
      method,
      bearer,
      headers: body === undefined ? {} : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })

  it('creates, lists, patches and deletes endpoints', async () => {
    const created = await createWebhookApi({
      request: call('/capture/webhooks', 'POST', {
        connectionId: a.connection.id,
        url: hookUrl,
        events: ['email.delivered', 'email.opened'],
      }),
    })
    expect(created.status).toBe(201)
    const endpoint = await created.json()
    expect(endpoint).toMatchObject({
      payloadFormat: 'resend',
      secret: expect.stringMatching(/^whsec_/),
    })
    const id = endpoint.id as string
    const list = await (await listWebhooksApi({ request: call('/capture/webhooks', 'GET') })).json()
    expect(list.data.map((e: { id: string }) => e.id)).toContain(id)
    const patched = await patchWebhookApi({
      request: call(`/capture/webhooks/${id}`, 'PATCH', { payloadFormat: 'brevo' }),
      params: { id },
    })
    expect(await patched.json()).toMatchObject({
      payloadFormat: 'brevo',
      events: ['delivered', 'opened'],
    })
    const invalid = await createWebhookApi({
      request: call('/capture/webhooks', 'POST', {
        connectionId: null,
        url: hookUrl,
        events: ['x'],
      }),
    })
    expect(invalid.status).toBe(422)
    const gone = await deleteWebhookApi({
      request: call(`/capture/webhooks/${id}`, 'DELETE'),
      params: { id },
    })
    expect(gone.status).toBe(200)
    expect(
      (await getWebhookApi({ request: call(`/capture/webhooks/${id}`, 'GET'), params: { id } }))
        .status,
    ).toBe(404)
  })

  it('previews, test-sends, delivers manual events, logs and replays', async () => {
    const preview = await previewWebhookApi({
      request: call('/capture/webhooks/preview', 'POST', {
        payloadFormat: 'unified',
        event: 'email.opened',
      }),
    })
    expect((await preview.json()).headers['X-Mailsink-Signature']).toBe('sha256=••••••••')

    const endpoint = await (
      await createWebhookApi({
        request: call('/capture/webhooks', 'POST', {
          connectionId: null,
          url: hookUrl,
          events: ['email.opened'],
        }),
      })
    ).json()
    const tested = await testWebhookApi({
      request: call(`/capture/webhooks/${endpoint.id}/test`, 'POST', { event: 'email.opened' }),
      params: { id: endpoint.id },
    })
    expect(await tested.json()).toMatchObject({
      status: 'succeeded',
      attempts: [{ responseStatus: 204 }],
    })

    const sent = await postEmail({
      request: call(
        '/v1/emails',
        'POST',
        { from: 'app@x.io', to: 'jane@x.io', subject: 'Hi', text: 'x' },
        a.connectionKey,
      ),
    })
    const messageId = (await sent.json()).id as string
    const event = await postMessageEventApi({
      request: call(`/capture/messages/${messageId}/events`, 'POST', { type: 'opened' }),
      params: { id: messageId },
    })
    expect(event.status).toBe(202)
    const triggered = await event.json()
    expect(triggered.events).toMatchObject([
      { type: 'opened', recipient: 'jane@x.io', origin: 'api' },
    ])
    expect(triggered.webhookDeliveries).toEqual([
      { id: expect.any(String), endpointId: endpoint.id },
    ])
    const deliveryId = triggered.webhookDeliveries[0].id as string

    const detail = await (
      await getMessage({
        request: call(`/capture/messages/${messageId}`, 'GET'),
        params: { id: messageId },
      })
    ).json()
    expect(detail.webhookDeliveries).toMatchObject([{ id: deliveryId, status: 'pending' }])
    const log = await (
      await listDeliveriesApi({
        request: call(`/capture/webhooks/deliveries?endpointId=${endpoint.id}`, 'GET'),
      })
    ).json()
    expect(log.data).toHaveLength(2) // the test send and the opened event
    const one = await (
      await getDeliveryApi({
        request: call(`/capture/webhooks/deliveries/${deliveryId}`, 'GET'),
        params: { id: deliveryId },
      })
    ).json()
    expect(JSON.parse(one.body)).toMatchObject({ event: 'email.opened', messageId })

    const noAttempt = await replayDeliveryApi({
      request: call(`/capture/webhooks/deliveries/${deliveryId}/replay`, 'POST'),
      params: { id: deliveryId },
    })
    expect(noAttempt.status).toBe(409)
    const replay = await replayDeliveryApi({
      request: call(`/capture/webhooks/deliveries/${deliveryId}/replay`, 'POST', {
        mode: 'resign',
      }),
      params: { id: deliveryId },
    })
    expect(replay.status).toBe(202)
    expect(await replay.json()).toMatchObject({
      replayOf: deliveryId,
      replayMode: 'resign',
      status: 'pending',
    })
    expect(hits).toBe(1)
  })
})
