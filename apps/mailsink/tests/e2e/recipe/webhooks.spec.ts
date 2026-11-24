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

test('webhooks reach a local receiver: test send, then delivery events', async ({
  app,
  mailsink,
}) => {
  const receiver = await startReceiver()
  try {
    const endpoint = await mailsink.webhooks.create({
      connectionId: null,
      url: receiver.url,
      events: ['email.delivered'],
      payloadFormat: 'unified',
    })
    expect(endpoint.secret).toMatch(/^whsec_/) // shown once: keep it to verify signatures

    // Test send: one signed sample event, answered with its attempt.
    expect(await mailsink.webhooks.test(endpoint.id)).toMatchObject({
      status: 'succeeded',
      attemptCount: 1,
    })
    expect(receiver.received).toHaveLength(1)
    expect(receiver.received[0]?.headers['x-mailsink-signature']).toMatch(/^sha256=/)

    // A real send: the simulation delivers, the worker posts `email.delivered`.
    const id = await app.send({ to: 'jane@example.com', subject: 'Welcome', text: 'Hello' })
    await expect
      .poll(async () => {
        const page = await mailsink.webhooks.deliveries.list({ endpointId: endpoint.id })
        return page.data.filter((d) => d.messageId === id).map((d) => d.status)
      })
      .toEqual(['succeeded'])
    const last = JSON.parse(receiver.received.at(-1)?.body ?? '{}')
    expect(last).toMatchObject({ event: 'email.delivered' })
  } finally {
    await receiver.close()
  }
})
