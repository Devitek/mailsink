import { createServer, type IncomingHttpHeaders } from 'node:http'
import type { AddressInfo } from 'node:net'
import { expect, test } from './fixtures'

// docs/guides/e2e.md, « Webhooks »: a local receiver started by the test, an endpoint of the
// workspace pointing at it, a test send, then the deliveries of a simulated delivery.

type Received = { headers: IncomingHttpHeaders; body: string }

async function startReceiver() {
  const received: Received[] = []
  const server = createServer((req, res) => {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
    })
    req.on('end', () => {
      received.push({ headers: req.headers, body })
      res.writeHead(204).end()
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  return {
    url: `http://127.0.0.1:${port}/hooks/mailsink`,
    received,
    close: () => new Promise((resolve) => server.close(resolve)),
  }
}

test('webhooks reach a local receiver: test send, then delivery events', async ({ mailsink }) => {
  const receiver = await startReceiver()
  try {
    const created = await mailsink.capture.post('/capture/webhooks', {
      data: { connectionId: null, url: receiver.url, events: ['email.delivered'] },
    })
    expect(created.status()).toBe(201)
    const endpoint = await created.json()
    expect(endpoint.secret).toMatch(/^whsec_/) // shown once: keep it to verify signatures

    // Test send: one signed sample event, answered with its attempt.
    const test = await mailsink.capture.post(`/capture/webhooks/${endpoint.id}/test`, {
      data: {},
    })
    expect(await test.json()).toMatchObject({ status: 'succeeded', attemptCount: 1 })
    expect(receiver.received).toHaveLength(1)
    expect(receiver.received[0]?.headers['x-mailsink-signature']).toMatch(/^sha256=/)

    // A real send: the simulation delivers, the worker posts `email.delivered`.
    const id = await mailsink.send({
      from: 'App <app@example.com>',
      to: 'jane@example.com',
      subject: 'Welcome',
      text: 'Hello',
    })
    await expect
      .poll(async () => {
        const res = await mailsink.capture.get('/capture/webhooks/deliveries', {
          params: { endpointId: endpoint.id },
        })
        return (await res.json()).data
          .filter((d: { messageId: string | null }) => d.messageId === id)
          .map((d: { canonicalEvent: string; status: string }) => d.status)
      })
      .toEqual(['succeeded'])
    const last = JSON.parse(receiver.received.at(-1)?.body ?? '{}')
    expect(last).toMatchObject({ event: 'email.delivered' })
  } finally {
    await receiver.close()
  }
})
