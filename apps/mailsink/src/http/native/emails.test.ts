import { messages } from '@mailsink/db'
import { describeDb } from '@mailsink/db/testing'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { stopRuntime } from '../../runtime/boot'
import { ADMIN_KEY, installTestRuntime, request, seedWorkspace } from '../test-fixtures'
import { postEmail, postEmailBatch } from './emails'

const email = (patch: Record<string, unknown> = {}) => ({
  from: 'App <app@example.com>',
  to: 'jane@x.io',
  subject: 'Welcome',
  text: 'Hello',
  ...patch,
})

describeDb('native ingestion routes', (ctx) => {
  let seed: Awaited<ReturnType<typeof seedWorkspace>>
  beforeAll(async () => {
    await installTestRuntime(ctx.handle, { maxMessageBytes: 4096 })
    seed = await seedWorkspace(ctx.db)
  })
  afterAll(() => stopRuntime())

  const call = (
    route: typeof postEmail,
    body: unknown,
    init: { bearer?: string; headers?: Record<string, string> } = {},
  ) =>
    route({
      request: request('/v1/emails', {
        method: 'POST',
        bearer: init.bearer ?? seed.connectionKey,
        headers: { 'content-type': 'application/json', ...init.headers },
        body: JSON.stringify(body),
      }),
    })

  it('POST /v1/emails stores the message for the calling connection', async () => {
    const res = await call(postEmail, email())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ id: expect.stringMatching(/^msg_/), status: 'queued' })
    const [row] = await ctx.db.select().from(messages).where(eq(messages.id, body.id))
    expect(row).toMatchObject({
      workspaceId: seed.workspace.id,
      connectionId: seed.connection.id,
      source: 'native',
    })
  })

  it('needs a connection key', async () => {
    expect((await call(postEmail, email(), { bearer: seed.workspaceKey })).status).toBe(403)
    expect((await call(postEmail, email(), { bearer: ADMIN_KEY })).status).toBe(403)
    expect((await call(postEmail, email(), { bearer: seed.revokedKey })).status).toBe(401)
  })

  it('answers 422 with the stable refinement code', async () => {
    const res = await call(postEmail, email({ text: undefined }))
    expect(res.status).toBe(422)
    const { error } = await res.json()
    expect(error.details.issues[0].params).toEqual({ code: 'html_or_text_required' })
  })

  it('answers 413 above MAILSINK_MAX_MESSAGE_BYTES', async () => {
    const res = await call(postEmail, email({ text: 'x'.repeat(5000) }))
    expect(res.status).toBe(413)
    expect((await res.json()).error.code).toBe('payload_too_large')
  })

  it('replays with Idempotency-Key and refuses another body (409)', async () => {
    const headers = { 'Idempotency-Key': 'order-42' }
    const first = await call(postEmail, email(), { headers })
    const again = await call(postEmail, email(), { headers })
    expect(again.headers.get('idempotent-replayed')).toBe('true')
    expect(first.headers.get('idempotent-replayed')).toBeNull()
    expect(await again.json()).toEqual(await first.json())
    const other = await call(postEmail, email({ subject: 'Other' }), { headers })
    expect(other.status).toBe(409)
    expect((await other.json()).error.code).toBe('idempotency_mismatch')
  })

  it('POST /v1/emails/batch answers 207 on partial success, 200 otherwise', async () => {
    const partial = await call(postEmailBatch, [email(), { to: 'nope' }])
    expect(partial.status).toBe(207)
    const { data } = await partial.json()
    expect(data).toMatchObject([
      { ok: true, index: 0, id: expect.stringMatching(/^msg_/) },
      { ok: false, index: 1, error: { code: 'validation_error' } },
    ])
    expect((await call(postEmailBatch, [email(), email()])).status).toBe(200)
  })

  it('validates the batch envelope as a whole', async () => {
    expect((await call(postEmailBatch, [])).status).toBe(422)
    expect((await call(postEmailBatch, { not: 'an array' })).status).toBe(422)
  })
})
