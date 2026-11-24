import { createServer, type IncomingHttpHeaders } from 'node:http'
import type { AddressInfo } from 'node:net'
import { type DeliverWebhookPayload, runAttempt } from '@mailsink/core'
import { jobs, messages } from '@mailsink/db'
import { describeDb } from '@mailsink/db/testing'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { stopRuntime } from '../../../runtime/boot'
import { postMessageEventApi } from '../../capture/events'
import { createWebhookApi, testWebhookApi } from '../../capture/webhooks'
import { replayDeliveryApi } from '../../capture/webhooks-deliveries'
import { installTestRuntime, request } from '../../test-fixtures'
import { postBrevoEmail } from './send'
import { provisionBrevo } from './testing'

// End to end Brevo webhooks (#149): a send through `POST /v3/smtp/email`, a forced simulated
// status, the delivery received by a local receiver. Covers `X-Mailin-custom` from the
// `headers` field, `invalid_email` and basic auth written in the endpoint URL (D278).

type Received = { headers: IncomingHttpHeaders; body: Record<string, unknown> }

describeDb('Brevo webhooks end to end', (ctx) => {
  let seed: Awaited<ReturnType<typeof provisionBrevo>>
  let base = ''
  const received: Received[] = []
  const server = createServer((req, res) => {
    let raw = ''
    req.on('data', (chunk) => {
      raw += chunk
    })
    req.on('end', () => {
      received.push({ headers: req.headers, body: JSON.parse(raw || '{}') })
      res.writeHead(200).end()
    })
  })
  const json = (path: string, method: string, body: unknown, headers: Record<string, string>) =>
    request(path, {
      method,
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    })
  const capture = (path: string, body: unknown) =>
    json(path, 'POST', body, { authorization: `Bearer ${seed.workspaceKey}` })
  /** Runs the queued attempt of a delivery, as the worker would. */
  const deliver = async (deliveryId: string) => {
    const queued = await ctx.db.select().from(jobs).where(eq(jobs.kind, 'deliver_webhook'))
    const job = queued.find((j) => (j.payload as DeliverWebhookPayload).deliveryId === deliveryId)
    await runAttempt(ctx.db, job?.payload as DeliverWebhookPayload, { retry: false })
    return received.at(-1)
  }

  beforeAll(async () => {
    await installTestRuntime(ctx.handle)
    seed = await provisionBrevo()
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    base = `127.0.0.1:${(server.address() as AddressInfo).port}`
  })
  afterAll(async () => {
    await stopRuntime()
    server.closeAllConnections()
    await new Promise((resolve) => server.close(resolve))
  })

  it('delivers X-Mailin-custom, invalid_email and error with URL credentials as basic auth', async () => {
    const created = await createWebhookApi({
      request: capture('/capture/webhooks', {
        connectionId: seed.brevoConnectionId,
        url: `http://acme:s%40cret@${base}/brevo?token=t1`,
        events: ['delivered', 'invalid', 'error'],
      }),
    })
    expect(created.status).toBe(201)
    const endpoint = await created.json()
    expect(endpoint).toMatchObject({
      url: `http://${base}/brevo?token=t1`,
      brevoAuth: { type: 'basic', username: 'acme' },
    })
    const basic = `Basic ${Buffer.from('acme:s@cret').toString('base64')}`

    const tested = await testWebhookApi({
      request: capture(`/capture/webhooks/${endpoint.id}/test`, { event: 'invalid' }),
      params: { id: endpoint.id },
    })
    expect(await tested.json()).toMatchObject({
      status: 'succeeded',
      dialectEvent: 'invalid_email',
    })
    expect(received.at(-1)?.headers.authorization).toBe(basic)

    const sent = await postBrevoEmail({
      request: json(
        '/v3/smtp/email',
        'POST',
        {
          sender: { email: 'shop@acme.test' },
          to: [{ email: 'jane@acme.test' }],
          subject: 'Order',
          textContent: 'x',
          headers: { 'X-Mailin-custom': 'order:42' },
        },
        { 'api-key': seed.brevoKey },
      ),
    })
    const { messageId } = await sent.json()
    const [row] = await ctx.db
      .select()
      .from(messages)
      .where(eq(messages.providerMessageId, messageId))
    const id = row?.id ?? ''
    const status = async (value: string) => {
      const res = await postMessageEventApi({
        request: capture(`/capture/messages/${id}/events`, { type: 'status', status: value }),
        params: { id },
      })
      return (await res.json()).webhookDeliveries[0].id as string
    }

    const delivered = await deliver(await status('delivered'))
    expect(delivered?.headers.authorization).toBe(basic)
    expect(delivered?.body).toMatchObject({
      event: 'delivered',
      'message-id': messageId,
      'X-Mailin-custom': 'order:42',
    })

    const invalidId = await status('invalid')
    const invalid = await deliver(invalidId)
    expect(invalid?.body).toMatchObject({
      event: 'invalid_email',
      email: 'jane@acme.test',
      'X-Mailin-custom': 'order:42',
    })
    // A failed send is Brevo `error` (D280).
    const failed = await deliver(await status('failed'))
    expect(failed?.body).toMatchObject({ event: 'error', email: 'jane@acme.test' })

    for (const mode of ['exact', 'resign']) {
      const replay = await replayDeliveryApi({
        request: capture(`/capture/webhooks/deliveries/${invalidId}/replay`, { mode }),
        params: { id: invalidId },
      })
      const replayed = await deliver((await replay.json()).id)
      expect(replayed?.headers.authorization).toBe(basic)
      expect(replayed?.body).toEqual(invalid?.body)
    }
  })
})
