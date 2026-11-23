import { createRateLimiter } from '@mailsink/core'
import { messages } from '@mailsink/db'
import { describeDb } from '@mailsink/db/testing'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest'
import { stopRuntime } from '../../../runtime/boot'
import { postOverride, postOverrideReset } from '../../capture/override'
import { ADMIN_KEY, installTestRuntime, request } from '../../test-fixtures'
import { getResendEmailRoute, postResendBatch, postResendEmail } from './emails'
import { createResendWorkspace } from './test-seed'

const email = { from: 'Acme <app@x.io>', to: ['jane@x.io'], subject: 'Hi', html: '<p>Hi</p>' }

describeDb('Resend dialect routes', (ctx) => {
  let clock = 0
  let draws: number[] = []
  let seed: Awaited<ReturnType<typeof createResendWorkspace>>

  const post = (
    route: typeof postResendEmail,
    body: unknown,
    init: { bearer?: string; headers?: Record<string, string> } = {},
  ) =>
    route({
      request: request('/emails', {
        method: 'POST',
        bearer: init.bearer ?? seed.resendKey,
        headers: { 'content-type': 'application/json', ...init.headers },
        body: JSON.stringify(body),
      }),
    })
  const get = (id: string, bearer = seed.resendKey) =>
    getResendEmailRoute({ request: request(`/emails/${id}`, { bearer }), params: { id } })
  const capture = (body: unknown) =>
    request('/capture/override', {
      method: 'POST',
      bearer: seed.workspaceKey,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })

  beforeAll(async () => {
    await installTestRuntime(
      ctx.handle,
      {},
      {
        rateLimiter: createRateLimiter({ now: () => clock }),
        chaosRandom: () => draws.shift() ?? 0.999,
      },
    )
    seed = await createResendWorkspace({ rateLimit: { limit: 5 } })
  })
  afterAll(() => stopRuntime())
  beforeEach(async () => {
    clock += 3_600_000
    draws = []
    await postOverrideReset({ request: capture({}) })
  })

  it('POST /emails stores a resend message and GET /emails/:id reads it back', async () => {
    const res = await post(postResendEmail, email)
    expect(res.status).toBe(200)
    const { id } = await res.json()
    const [row] = await ctx.db
      .select()
      .from(messages)
      .where(eq(messages.id, `msg_${id}`))
    expect(row).toMatchObject({ source: 'resend', connectionId: seed.resendConnectionId })
    const read = await get(id)
    expect(read.status).toBe(200)
    expect(await read.json()).toMatchObject({ object: 'email', id, to: ['jane@x.io'] })
  })

  it('answers errors in the Resend body shape', async () => {
    const missing = await post(postResendEmail, { ...email, to: undefined })
    expect(missing.status).toBe(422)
    expect(await missing.json()).toEqual({
      statusCode: 422,
      name: 'missing_required_field',
      message: 'Missing `to` field.',
    })
    const notFound = await get('0190c9a4-0000-7000-8000-000000000000')
    expect(await notFound.json()).toEqual({
      statusCode: 404,
      name: 'not_found',
      message: 'Email not found',
    })
    const malformed = await get('nope')
    expect(malformed.status).toBe(422)
    expect((await malformed.json()).name).toBe('invalid_parameter')
  })

  it('takes resend connection keys only (403 restricted_api_key otherwise)', async () => {
    for (const bearer of [seed.brevoKey, seed.workspaceKey, ADMIN_KEY]) {
      const res = await post(postResendEmail, email, { bearer })
      expect(res.status).toBe(403)
      expect((await res.json()).name).toBe('restricted_api_key')
    }
    const invalid = await post(postResendEmail, email, { bearer: 'msk_nope' })
    expect(invalid.status).toBe(401)
    expect(await invalid.json()).toEqual({
      statusCode: 401,
      name: 'validation_error',
      message: 'API key is invalid',
    })
  })

  it('answers a missing key 401 missing_api_key and an unknown key on a read 400', async () => {
    const missing = await post(postResendEmail, email, { bearer: '' })
    expect(missing.status).toBe(401)
    expect(await missing.json()).toEqual({
      statusCode: 401,
      name: 'missing_api_key',
      message: 'Missing API Key',
    })
    const read = await get('msg_x', 'msk_nope')
    expect(read.status).toBe(400)
    expect(await read.json()).toEqual({
      statusCode: 400,
      name: 'validation_error',
      message: 'API key is invalid',
    })
  })

  it('batch is all or nothing by default, partial with x-batch-validation: permissive', async () => {
    const strict = await post(postResendBatch, [email, { ...email, from: 'bad' }])
    expect(strict.status).toBe(400)
    expect((await strict.json()).message).toMatch(/^emails\[1\]: Invalid `from` field/)
    const permissive = await post(postResendBatch, [email, { ...email, from: 'bad' }], {
      headers: { 'x-batch-validation': 'permissive' },
    })
    expect(permissive.status).toBe(200)
    const body = await permissive.json()
    expect(body.data).toHaveLength(1)
    expect(body.errors[0].index).toBe(1)
    const wrong = await post(postResendBatch, [email], { headers: { 'x-batch-validation': 'x' } })
    expect(wrong.status).toBe(400)
  })

  it('idempotency-key: replay, mismatch and length in Resend terms', async () => {
    const headers = { 'idempotency-key': 'order-42' }
    const first = await (await post(postResendEmail, email, { headers })).json()
    const again = await post(postResendEmail, email, { headers })
    expect(await again.json()).toEqual(first)
    expect(again.headers.get('idempotent-replayed')).toBe('true')
    const mismatch = await post(postResendEmail, { ...email, subject: 'x' }, { headers })
    expect(mismatch.status).toBe(409)
    expect((await mismatch.json()).name).toBe('invalid_idempotent_request')
    const long = await post(postResendEmail, email, {
      headers: { 'idempotency-key': 'k'.repeat(257) },
    })
    expect(long.status).toBe(400)
    expect((await long.json()).name).toBe('invalid_idempotency_key')
  })

  it('sends ratelimit-* next to X-RateLimit-* and 429 rate_limit_exceeded', async () => {
    await postOverride({
      request: capture({ config: { rateLimit: { limit: 1, windowSeconds: 60 } } }),
    })
    const ok = await post(postResendEmail, email)
    expect(ok.headers.get('ratelimit-limit')).toBe('1')
    expect(ok.headers.get('ratelimit-remaining')).toBe(ok.headers.get('x-ratelimit-remaining'))
    expect(ok.headers.get('ratelimit-reset')).toBe(ok.headers.get('x-ratelimit-reset'))
    const limited = await get('0190c9a4-0000-7000-8000-000000000000')
    expect(limited.status).toBe(429)
    expect(limited.headers.get('retry-after')).toBe('60')
    expect(limited.headers.get('ratelimit-remaining')).toBe('0')
    expect((await limited.json()).name).toBe('rate_limit_exceeded')
  })

  it('chaos answers the drawn status with the matching Resend name', async () => {
    await postOverride({
      request: capture({ config: { chaos: { errorRate: 100, httpCodes: [503, 500, 429] } } }),
    })
    draws = [0, 0, 0, 0.5, 0, 0.9]
    const names = []
    for (let i = 0; i < 3; i++) {
      const res = await post(postResendEmail, email)
      names.push([res.status, (await res.json()).name])
    }
    expect(names).toEqual([
      [503, 'service_unavailable'],
      [500, 'application_error'],
      [429, 'rate_limit_exceeded'],
    ])
  })
})
