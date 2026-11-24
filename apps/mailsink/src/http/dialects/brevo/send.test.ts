import { createRateLimiter } from '@mailsink/core'
import { messages } from '@mailsink/db'
import { describeDb } from '@mailsink/db/testing'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest'
import { stopRuntime } from '../../../runtime/boot'
import { postOverride, postOverrideReset } from '../../capture/override'
import { ADMIN_KEY, installTestRuntime, request } from '../../test-fixtures'
import { postBrevoEmail } from './send'
import { provisionBrevo } from './testing'

const email = {
  sender: { email: 'app@example.com' },
  to: [{ email: 'jane@x.io' }],
  subject: 'Hi',
  htmlContent: '<p>Hi</p>',
}

describeDb('Brevo route POST /v3/smtp/email', (ctx) => {
  let clock = 0
  let seed: Awaited<ReturnType<typeof provisionBrevo>>
  const send = (body: unknown, headers: Record<string, string> = {}) =>
    postBrevoEmail({
      request: request('/v3/smtp/email', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'api-key': seed.brevoKey, ...headers },
        body: typeof body === 'string' ? body : JSON.stringify(body),
      }),
    })
  const capture = (path: string, body: unknown) => ({
    request: request(path, {
      method: 'POST',
      bearer: seed.workspaceKey,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  })

  beforeAll(async () => {
    await installTestRuntime(
      ctx.handle,
      { maxMessageBytes: 64 * 1024 },
      { rateLimiter: createRateLimiter({ now: () => clock }), chaosRandom: () => 0 },
    )
    seed = await provisionBrevo({ rateLimit: { limit: 5 } })
  })
  afterAll(() => stopRuntime())
  beforeEach(async () => {
    clock += 3_600_000
    await postOverrideReset(capture('/capture/override/reset', {}))
  })

  it('stores the message with source brevo and answers 201 { messageId }', async () => {
    const res = await send(email)
    expect(res.status).toBe(201)
    const { messageId } = await res.json()
    const [row] = await ctx.db
      .select()
      .from(messages)
      .where(eq(messages.providerMessageId, messageId))
    expect(row).toMatchObject({ source: 'brevo', connectionId: seed.brevoConnectionId })
  })

  it('emits X-RateLimit-* and x-sib-ratelimit-* headers', async () => {
    const res = await send(email)
    expect(res.headers.get('x-ratelimit-limit')).toBe('5')
    expect(res.headers.get('x-sib-ratelimit-limit')).toBe('5')
    expect(res.headers.get('x-sib-ratelimit-remaining')).toBe('4')
    expect(res.headers.get('x-sib-ratelimit-reset')).toBe(res.headers.get('x-ratelimit-reset'))
  })

  it('answers 429 too_many_requests past the limit', async () => {
    for (let i = 0; i < 5; i++) await send({})
    const res = await send(email)
    expect(res.status).toBe(429)
    expect(res.headers.get('retry-after')).toBe('1')
    expect(await res.json()).toEqual({
      code: 'too_many_requests',
      message: 'Rate limit exceeded, retry in 1s',
    })
  })

  it('answers chaos in the Brevo shape', async () => {
    await postOverride(
      capture('/capture/override', { config: { chaos: { errorRate: 100, httpCodes: [502] } } }),
    )
    const res = await send(email)
    expect(res.status).toBe(502)
    expect(await res.json()).toEqual({
      code: 'chaos_injected',
      message: 'Simulated failure (chaos 502)',
    })
  })

  it('answers 400 missing_parameter / invalid_parameter, never 422', async () => {
    const missing = await send({ ...email, sender: undefined })
    expect(missing.status).toBe(400)
    expect(await missing.json()).toEqual({
      code: 'missing_parameter',
      message: 'sender: sender is required when templateId is absent',
    })
    const invalid = await send({ ...email, to: [{ email: 'not-an-email' }] })
    expect(invalid.status).toBe(400)
    expect((await invalid.json()).code).toBe('invalid_parameter')
    const unreadable = await send('{oops')
    expect(unreadable.status).toBe(400)
    expect((await unreadable.json()).code).toBe('invalid_parameter')
    const template = await send({ ...email, templateId: 4242 })
    expect(await template.json()).toEqual({
      code: 'invalid_parameter',
      message: 'templateId: Template ID 4242 does not exist',
    })
  })

  it('answers 413 out_of_range above MAILSINK_MAX_MESSAGE_BYTES', async () => {
    const res = await send({ ...email, htmlContent: 'x'.repeat(70 * 1024) })
    expect(res.status).toBe(413)
    expect((await res.json()).code).toBe('out_of_range')
  })

  it('answers unauthorized and permission_denied in the Brevo shape', async () => {
    const unknown = await send(email, { 'api-key': 'msk_unknownunknownunknown' })
    expect(unknown.status).toBe(401)
    expect((await unknown.json()).code).toBe('unauthorized')
    const resend = await send(email, { 'api-key': seed.resendKey })
    expect(resend.status).toBe(403)
    expect((await resend.json()).code).toBe('permission_denied')
    const admin = await send(email, { 'api-key': ADMIN_KEY })
    expect(admin.status).toBe(403)
  })

  it('refuses a reused idempotencyKey with 400 duplicate_parameter, same body or not (D279)', async () => {
    const key = 'c3d4e5f6-a7b8-4c3d-8e4f-5a6b7c8d9e0f'
    const body = { ...email, headers: { idempotencyKey: key } }
    expect((await send(body)).status).toBe(201)
    for (const again of [body, { ...body, subject: 'Other' }]) {
      const res = await send(again)
      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({
        code: 'duplicate_parameter',
        message: `Request already processed: idempotencyKey ${key} was used in the last 30 minutes`,
      })
    }
  })

  it('refuses an idempotencyKey that is not a UUID and ignores the Idempotency-Key header', async () => {
    const bad = await send({ ...email, headers: { idempotencyKey: 'order-42' } })
    expect(bad.status).toBe(400)
    expect(await bad.json()).toEqual({
      code: 'invalid_parameter',
      message: 'headers.idempotencyKey: idempotencyKey must be a UUID',
    })
    const viaHttp = { 'Idempotency-Key': 'http-key-1' }
    expect((await send(email, viaHttp)).status).toBe(201)
    expect((await send(email, viaHttp)).status).toBe(201)
  })
})
