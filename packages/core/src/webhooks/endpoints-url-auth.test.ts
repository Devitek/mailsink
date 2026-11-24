import { WebhookEndpointInput } from '@mailsink/contracts'
import { webhookEndpoints } from '@mailsink/db'
import { createTestWorkspace, describeDb } from '@mailsink/db/testing'
import { eq } from 'drizzle-orm'
import { beforeEach, expect, it } from 'vitest'
import { createWebhookEndpoint, patchWebhookEndpoint } from './endpoints'

// Basic auth written in the endpoint URL (#149, D278): stored as brevoAuth basic, never kept
// in the URL.

describeDb('webhook endpoint URL credentials', (ctx) => {
  let ws = ''
  const input = (patch: Record<string, unknown>) =>
    WebhookEndpointInput.parse({ connectionId: null, events: ['delivered'], ...patch })
  const stored = async (id: string) =>
    (await ctx.db.select().from(webhookEndpoints).where(eq(webhookEndpoints.id, id)))[0]
  const issueCode = (p: Promise<unknown>) =>
    p.then(
      () => 'ok',
      (e: { details?: { issues: { params?: { code: string } }[] } }) =>
        e.details?.issues[0]?.params?.code,
    )

  beforeEach(async () => {
    ws = (await createTestWorkspace(ctx.db)).id
  })

  it('turns URL credentials into brevoAuth basic at creation', async () => {
    const created = await createWebhookEndpoint(
      ctx.db,
      ws,
      input({ payloadFormat: 'brevo', url: 'https://acme:s%40cret@hooks.example.com/b?token=t' }),
    )
    expect(created).toMatchObject({
      url: 'https://hooks.example.com/b?token=t',
      brevoAuth: { type: 'basic', username: 'acme' },
    })
    expect(JSON.stringify(created)).not.toContain('s@cret')
    expect(await stored(created.id)).toMatchObject({
      url: 'https://hooks.example.com/b?token=t',
      brevoAuth: 'basic',
      secret: 'acme:s@cret',
    })
  })

  it('turns URL credentials into brevoAuth basic on PATCH', async () => {
    const created = await createWebhookEndpoint(
      ctx.db,
      ws,
      input({ payloadFormat: 'brevo', url: 'https://hooks.example.com/b' }),
    )
    const patched = await patchWebhookEndpoint(ctx.db, ws, created.id, {
      url: 'https://ops:pw@hooks.example.com/c',
    })
    expect(patched).toMatchObject({
      url: 'https://hooks.example.com/c',
      brevoAuth: { type: 'basic', username: 'ops' },
    })
    expect((await stored(created.id))?.secret).toBe('ops:pw')
  })

  it('refuses URL credentials on another format or next to an explicit auth', async () => {
    expect(
      await issueCode(
        createWebhookEndpoint(
          ctx.db,
          ws,
          input({ payloadFormat: 'unified', events: ['email.sent'], url: 'https://u:p@h.test/' }),
        ),
      ),
    ).toBe('url_credentials_require_brevo')
    expect(
      await issueCode(
        createWebhookEndpoint(
          ctx.db,
          ws,
          input({
            payloadFormat: 'brevo',
            url: 'https://u:p@h.test/',
            brevoAuth: { type: 'bearer', token: 't' },
          }),
        ),
      ),
    ).toBe('conflicting_webhook_auth')
  })
})
