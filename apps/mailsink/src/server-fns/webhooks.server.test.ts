import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { CreateWorkspaceRequest, WebhookEndpointInput } from '@mailsink/contracts'
import { describeDb } from '@mailsink/db/testing'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { installTestRuntime } from '../http/test-fixtures'
import { stopRuntime } from '../runtime/boot'
import type { Runtime } from '../runtime/container'
import {
  createEndpoint,
  deleteEndpoint,
  listEndpoints,
  previewEndpoint,
  revealSecret,
  testEndpoint,
  updateEndpoint,
} from './webhooks.server'
import { createWorkspaceFromUi } from './workspaces-manage.server'

describeDb('UI webhook endpoints', (ctx) => {
  let runtime: Runtime
  let receiver: Server
  let url = ''
  const received: { headers: Record<string, unknown>; body: string }[] = []

  beforeAll(async () => {
    runtime = await installTestRuntime(ctx.handle, { publicUrl: 'https://mail.test' })
    receiver = createServer((req, res) => {
      let body = ''
      req.on('data', (chunk) => {
        body += chunk
      })
      req.on('end', () => {
        received.push({ headers: req.headers, body })
        res.writeHead(204).end()
      })
    })
    await new Promise<void>((resolve) => receiver.listen(0, '127.0.0.1', resolve))
    url = `http://127.0.0.1:${(receiver.address() as AddressInfo).port}/hooks`
    const created = await createWorkspaceFromUi(
      runtime,
      CreateWorkspaceRequest.parse({ name: 'Hooks', slug: 'hooks-ui' }),
    )
    if (!created.ok) throw new Error('expected a workspace')
  })
  afterAll(async () => {
    await new Promise((resolve) => receiver.close(resolve))
    await stopRuntime()
  })

  const input = (raw: unknown) => WebhookEndpointInput.parse(raw)

  it('creates, reveals, rotates, tests, disables and deletes an endpoint', async () => {
    const saved = await createEndpoint(
      runtime,
      'hooks-ui',
      input({ connectionId: null, url, events: ['email.delivered'] }),
    )
    if (!saved.ok) throw new Error('expected an endpoint')
    const { endpoint } = saved
    expect(endpoint).toMatchObject({ payloadFormat: 'unified', secret: expect.any(String) })
    expect(await revealSecret(runtime, 'hooks-ui', endpoint.id)).toEqual({
      secret: endpoint.secret,
    })

    const rotated = await updateEndpoint(runtime, 'hooks-ui', endpoint.id, { rotateSecret: true })
    if (!rotated.ok) throw new Error('expected a rotation')
    expect(rotated.endpoint.secret).not.toBe(endpoint.secret)

    const result = await testEndpoint(runtime, 'hooks-ui', endpoint.id, undefined)
    expect(result).toMatchObject({ status: 'succeeded', statusCode: 204, event: 'email.delivered' })
    expect(received.at(-1)?.headers['x-mailsink-signature']).toBeDefined()
    const [row] = await listEndpoints(runtime, 'hooks-ui')
    expect(row?.lastDelivery).toMatchObject({ status: 'succeeded', statusCode: 204 })

    const off = await updateEndpoint(runtime, 'hooks-ui', endpoint.id, { enabled: false })
    expect(off.ok && off.endpoint.enabled).toBe(false)
    await deleteEndpoint(runtime, 'hooks-ui', endpoint.id)
    expect(await listEndpoints(runtime, 'hooks-ui')).toEqual([])
  })

  it('answers core refusals as field issues and keeps Brevo credentials write-only', async () => {
    const reserved = await createEndpoint(
      runtime,
      'hooks-ui',
      input({
        connectionId: null,
        url,
        events: ['email.delivered'],
        customHeaders: [{ key: 'Authorization', value: 'x' }],
      }),
    )
    expect(reserved).toEqual({
      ok: false,
      issues: [
        {
          path: 'customHeaders.0.key',
          code: 'reserved_webhook_header',
          message: expect.any(String),
        },
      ],
    })
    const brevo = await createEndpoint(
      runtime,
      'hooks-ui',
      input({
        connectionId: null,
        url,
        payloadFormat: 'brevo',
        events: ['hardBounce'],
        brevoAuth: { type: 'bearer', token: 'tok' },
      }),
    )
    if (!brevo.ok) throw new Error('expected a brevo endpoint')
    expect(await revealSecret(runtime, 'hooks-ui', brevo.endpoint.id)).toEqual({ secret: null })
  })

  it('previews the payload and masked signature headers of a format', async () => {
    const preview = await previewEndpoint(runtime, 'hooks-ui', {
      payloadFormat: 'resend',
      event: 'email.bounced',
    })
    expect(JSON.parse(preview.body)).toMatchObject({ type: 'email.bounced' })
    expect(preview.headers['svix-signature']).toBe('v1,••••••••')
  })
})
