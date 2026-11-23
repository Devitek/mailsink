import { privateAddressGuard } from '@mailsink/core'
import { describeDb } from '@mailsink/db/testing'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { stopRuntime } from '../../runtime/boot'
import { installTestRuntime, request, seedWorkspace } from '../test-fixtures'
import { createWebhookApi } from './webhooks'

describeDb('Webhook API with MAILSINK_WEBHOOK_BLOCK_PRIVATE', (ctx) => {
  let a: Awaited<ReturnType<typeof seedWorkspace>>
  beforeAll(async () => {
    await installTestRuntime(ctx.handle, {}, { webhookUrlGuard: privateAddressGuard() })
    a = await seedWorkspace(ctx.db)
  })
  afterAll(() => stopRuntime())

  const create = (url: string) =>
    createWebhookApi({
      request: request('/capture/webhooks', {
        method: 'POST',
        bearer: a.workspaceKey,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ connectionId: null, url, events: ['email.delivered'] }),
      }),
    })

  it('answers 422 on url for a loopback or link-local endpoint', async () => {
    for (const url of ['http://127.0.0.1:4000/hook', 'http://169.254.169.254/latest']) {
      const response = await create(url)
      expect(response.status).toBe(422)
      expect(JSON.stringify(await response.json())).toContain('private_webhook_url')
    }
  })
})
