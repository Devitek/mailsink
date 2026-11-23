import { WebhookEndpointInput } from '@mailsink/contracts'
import { createTestConnection, createTestWorkspace, describeDb } from '@mailsink/db/testing'
import { beforeEach, expect, it } from 'vitest'
import {
  createWebhookEndpoint,
  getWebhookEndpointView,
  listWebhookEndpointViews,
  patchWebhookEndpoint,
  removeWebhookEndpoint,
} from './endpoints'

describeDb('webhook endpoints', (ctx) => {
  let ws = ''
  let resendCon = ''
  let brevoCon = ''
  let smtpCon = ''
  const input = (patch: Record<string, unknown>) =>
    WebhookEndpointInput.parse({ connectionId: null, url: 'https://hooks.test/x', ...patch })

  beforeEach(async () => {
    ws = (await createTestWorkspace(ctx.db)).id
    resendCon = (await createTestConnection(ctx.db, ws)).id
    brevoCon = (await createTestConnection(ctx.db, ws, { kind: 'brevo', name: 'B' })).id
    smtpCon = (
      await createTestConnection(ctx.db, ws, {
        kind: 'smtp',
        name: 'S',
        smtpUsername: `u-${ws}`,
      })
    ).id
  })

  it('defaults the format from the scope and stores dialect events canonical', async () => {
    const resend = await createWebhookEndpoint(
      ctx.db,
      ws,
      input({ connectionId: resendCon, events: ['email.delivery_delayed', 'email.bounced'] }),
    )
    expect(resend).toMatchObject({
      payloadFormat: 'resend',
      canonicalEvents: ['email.deferred', 'email.soft_bounced', 'email.hard_bounced'],
      events: ['email.delivery_delayed', 'email.bounced'],
      unsupportedEvents: [],
      brevoAuth: { type: 'none' },
    })
    expect(resend.secret).toMatch(/^whsec_[A-Za-z0-9+/]{32}$/)
    expect(resend.secretPreview).toBe(`${resend.secret?.slice(0, 10)}…`)

    const brevo = await createWebhookEndpoint(
      ctx.db,
      ws,
      input({
        connectionId: brevoCon,
        events: ['hardBounce', 'spam'],
        brevoAuth: { type: 'basic', username: 'u', password: 'p' },
      }),
    )
    expect(brevo).toMatchObject({
      payloadFormat: 'brevo',
      events: ['hardBounce', 'spam'],
      secret: null,
      secretPreview: null,
      brevoAuth: { type: 'basic', username: 'u' },
    })
    expect(brevo.numericId).toBeGreaterThan(resend.numericId)
    const smtp = await createWebhookEndpoint(
      ctx.db,
      ws,
      input({ connectionId: smtpCon, events: ['email.sent'] }),
    )
    expect(smtp.payloadFormat).toBe('unified')
    const workspace = await createWebhookEndpoint(ctx.db, ws, input({ events: ['email.sent'] }))
    expect(workspace.payloadFormat).toBe('unified')
  })

  it('refuses unknown events, misplaced brevoAuth, reserved headers and foreign scopes', async () => {
    const code = (p: Promise<unknown>) =>
      p.then(
        () => 'ok',
        (e: { code?: string; details?: { issues: { params?: { code: string } }[] } }) =>
          e.details?.issues[0]?.params?.code ?? e.code,
      )
    expect(
      await code(createWebhookEndpoint(ctx.db, ws, input({ events: ['email.bounced'] }))),
    ).toBe('unknown_webhook_event')
    expect(
      await code(
        createWebhookEndpoint(
          ctx.db,
          ws,
          input({ events: ['email.sent'], brevoAuth: { type: 'bearer', token: 't' } }),
        ),
      ),
    ).toBe('brevo_auth_requires_brevo')
    expect(
      await code(
        createWebhookEndpoint(
          ctx.db,
          ws,
          input({ events: ['email.sent'], customHeaders: [{ key: 'svix-id', value: 'x' }] }),
        ),
      ),
    ).toBe('reserved_webhook_header')
    const other = await createTestWorkspace(ctx.db)
    const foreign = await createTestConnection(ctx.db, other.id)
    expect(
      await code(
        createWebhookEndpoint(
          ctx.db,
          ws,
          input({ connectionId: foreign.id, events: ['email.sent'] }),
        ),
      ),
    ).toBe('not_found')
  })

  it('keeps the canonical subscription across a format change and rotates secrets', async () => {
    const created = await createWebhookEndpoint(
      ctx.db,
      ws,
      input({ events: ['email.failed', 'email.suppressed', 'email.delivered'] }),
    )
    const toBrevo = await patchWebhookEndpoint(ctx.db, ws, created.id, {
      payloadFormat: 'brevo',
      brevoAuth: { type: 'bearer', token: 'tok' },
    })
    expect(toBrevo).toMatchObject({
      canonicalEvents: ['email.delivered', 'email.suppressed', 'email.failed'],
      events: ['delivered', 'blocked'],
      unsupportedEvents: ['email.failed'],
      brevoAuth: { type: 'bearer' },
      secret: null,
    })
    const toResend = await patchWebhookEndpoint(ctx.db, ws, created.id, { payloadFormat: 'resend' })
    expect(toResend.unsupportedEvents).toEqual(['email.suppressed'])
    expect(toResend.secret).toMatch(/^whsec_/)
    const rotated = await patchWebhookEndpoint(ctx.db, ws, created.id, { rotateSecret: true })
    expect(rotated.secret).not.toBe(toResend.secret)
    const kept = await patchWebhookEndpoint(ctx.db, ws, created.id, { enabled: false })
    expect(kept).toMatchObject({
      enabled: false,
      secret: null,
      secretPreview: rotated.secretPreview,
    })
  })

  it('lists by scope, reads, deletes, and hides other workspaces', async () => {
    const a = await createWebhookEndpoint(ctx.db, ws, input({ events: ['email.sent'] }))
    const b = await createWebhookEndpoint(
      ctx.db,
      ws,
      input({ connectionId: brevoCon, events: ['request'] }),
    )
    await createWebhookEndpoint(
      ctx.db,
      ws,
      input({ connectionId: resendCon, events: ['email.sent'] }),
    )
    const scoped = await listWebhookEndpointViews(ctx.db, ws, { connectionId: brevoCon })
    expect(scoped.data.map((e) => e.id)).toEqual([a.id, b.id])
    expect((await getWebhookEndpointView(ctx.db, ws, b.id)).url).toBe('https://hooks.test/x')
    const other = await createTestWorkspace(ctx.db)
    await expect(getWebhookEndpointView(ctx.db, other.id, b.id)).rejects.toMatchObject({
      code: 'not_found',
    })
    expect(await removeWebhookEndpoint(ctx.db, ws, b.id)).toEqual({ id: b.id })
    await expect(removeWebhookEndpoint(ctx.db, ws, b.id)).rejects.toMatchObject({
      code: 'not_found',
    })
  })
})
