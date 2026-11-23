import { WebhookEndpointInput } from '@mailsink/contracts'
import { jobs, listWebhookAttempts } from '@mailsink/db'
import { createTestWorkspace, describeDb } from '@mailsink/db/testing'
import { beforeEach, expect, it, vi } from 'vitest'
import { createWebhookEndpoint, patchWebhookEndpoint } from './endpoints'
import { sendTestWebhook } from './sample-send'
import { privateAddressGuard } from './url-guard'

describeDb('MAILSINK_WEBHOOK_BLOCK_PRIVATE', (ctx) => {
  let ws = ''
  const urlGuard = privateAddressGuard(async (host) =>
    host === 'internal.example'
      ? [{ address: '10.0.0.5', family: 4 }]
      : [{ address: '93.184.215.14', family: 4 }],
  )
  const input = (url: string) =>
    WebhookEndpointInput.parse({ connectionId: null, url, events: ['email.delivered'] })
  const refused = {
    code: 'validation_error',
    details: { issues: [expect.objectContaining({ path: ['url'] })] },
  }

  beforeEach(async () => {
    ws = (await createTestWorkspace(ctx.db)).id
  })

  it('refuses private URLs at creation and update, only when enabled', async () => {
    await expect(
      createWebhookEndpoint(ctx.db, ws, input('http://127.0.0.1:9/x'), { urlGuard }),
    ).rejects.toMatchObject(refused)
    await expect(
      createWebhookEndpoint(ctx.db, ws, input('https://internal.example/x'), { urlGuard }),
    ).rejects.toMatchObject(refused)
    const ok = await createWebhookEndpoint(ctx.db, ws, input('https://hooks.example/x'), {
      urlGuard,
    })
    await expect(
      patchWebhookEndpoint(ctx.db, ws, ok.id, { url: 'http://[fe80::1]/x' }, { urlGuard }),
    ).rejects.toMatchObject(refused)
    // Off by default: the same URL is accepted without a guard.
    await expect(
      createWebhookEndpoint(ctx.db, ws, input('http://127.0.0.1:9/x')),
    ).resolves.toMatchObject({ url: 'http://127.0.0.1:9/x' })
  })

  it('refuses at send time without calling the URL, and does not retry', async () => {
    const endpoint = await createWebhookEndpoint(ctx.db, ws, input('https://internal.example/x'))
    const fetch = vi.fn(async () => new Response('ok'))
    const detail = await sendTestWebhook(ctx.db, ws, endpoint.id, undefined, { urlGuard, fetch })
    expect(fetch).not.toHaveBeenCalled()
    expect(detail).toMatchObject({ status: 'failed', attemptCount: 1 })
    const [attempt] = await listWebhookAttempts(ctx.db, detail.id)
    expect(attempt?.error).toMatch(/^blocked: internal\.example .* 10\.0\.0\.5$/)
    expect(await ctx.db.select().from(jobs)).toEqual([])
  })
})
