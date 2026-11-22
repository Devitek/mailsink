import { SendEmailRequest } from '@mailsink/contracts'
import { idempotencyKeys, messages } from '@mailsink/db'
import { describeDb } from '@mailsink/db/testing'
import { and, eq } from 'drizzle-orm'
import { beforeAll, expect, it } from 'vitest'
import { hashRequest, readIdempotencyKey } from './idempotency'
import { sendNativeBatch, sendNativeEmail } from './native'
import type { IngestTarget } from './normalize'
import { sampleRequest, seedTarget } from './testing/fixtures'

const MAX = 16 * 1024

describeDb('native ingestion: batch and idempotency', (ctx) => {
  let target: IngestTarget
  beforeAll(async () => {
    target = await seedTarget(ctx.db)
  })
  const deps = () => ({ db: ctx.db, maxMessageBytes: MAX })
  const single = (key?: string, subject = 'Welcome') =>
    sendNativeEmail(deps(), target, SendEmailRequest.parse(sampleRequest({ subject })), key)
  const count = async () =>
    (await ctx.db.select().from(messages).where(eq(messages.workspaceId, target.workspaceId)))
      .length

  it('answers 207 with one slot per item when some items fail', async () => {
    const items = [
      sampleRequest({ subject: 'one' }),
      { from: 'nope', to: 'jane@x.io', subject: 'bad' },
      sampleRequest({ html: 'z'.repeat(MAX) }),
      sampleRequest({ subject: 'four' }),
    ]
    const { response } = await sendNativeBatch(deps(), target, items)
    expect(response.status).toBe(207)
    const { data } = response.body as { data: Record<string, unknown>[] }
    expect(data.map((d) => [d.index, d.ok])).toEqual([
      [0, true],
      [1, false],
      [2, false],
      [3, true],
    ])
    expect(data[1]).toMatchObject({ error: { code: 'validation_error' } })
    expect(data[2]).toMatchObject({
      error: { code: 'payload_too_large', details: { maxBytes: MAX } },
    })
    const stored = await ctx.db
      .select()
      .from(messages)
      .where(eq(messages.id, String(data[3]?.id)))
    expect(stored[0]?.subject).toBe('four')
  })

  it('answers 200 when every item is accepted', async () => {
    const { response } = await sendNativeBatch(deps(), target, [sampleRequest(), sampleRequest()])
    expect(response.status).toBe(200)
    expect((response.body as { data: { ok: boolean }[] }).data.every((d) => d.ok)).toBe(true)
  })

  it('replays the stored response for the same key and body', async () => {
    const before = await count()
    const first = await single('key-1')
    const second = await single('key-1')
    expect(first.replayed).toBe(false)
    expect(second).toEqual({ response: first.response, replayed: true })
    expect(await count()).toBe(before + 1)
    const [message] = await ctx.db
      .select()
      .from(messages)
      .where(eq(messages.id, (first.response.body as { id: string }).id))
    expect(message?.idempotencyKey).toBe('key-1')
  })

  it('refuses the same key with another body (idempotency_mismatch, 409)', async () => {
    await single('key-2')
    await expect(single('key-2', 'Other')).rejects.toMatchObject({
      code: 'idempotency_mismatch',
      status: 409,
    })
    await expect(sendNativeBatch(deps(), target, [sampleRequest()], 'key-2')).rejects.toMatchObject(
      { code: 'idempotency_mismatch' },
    )
  })

  it('replays batches too, and forgets a key after 24 h', async () => {
    const first = await sendNativeBatch(deps(), target, [sampleRequest()], 'key-3')
    expect(await sendNativeBatch(deps(), target, [sampleRequest()], 'key-3')).toEqual({
      ...first,
      replayed: true,
    })
    await ctx.db
      .update(idempotencyKeys)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(
        and(eq(idempotencyKeys.workspaceId, target.workspaceId), eq(idempotencyKeys.key, 'key-3')),
      )
    const again = await sendNativeBatch(deps(), target, [sampleRequest()], 'key-3')
    expect(again.replayed).toBe(false)
    expect(again.response.body).not.toEqual(first.response.body)
  })

  it('stores one message when two requests race on a new key', async () => {
    const before = await count()
    const [a, b] = await Promise.all([single('key-race'), single('key-race')])
    expect(a?.response).toEqual(b?.response)
    expect(await count()).toBe(before + 1)
  })
})

it('hashes bodies independently of key order and scope-sensitively', () => {
  expect(hashRequest('s', { a: 1, b: [1, { c: 2, d: 3 }] })).toBe(
    hashRequest('s', { b: [1, { d: 3, c: 2 }], a: 1 }),
  )
  expect(hashRequest('s', { a: 1 })).not.toBe(hashRequest('t', { a: 1 }))
})

it('reads the Idempotency-Key header and caps its length', () => {
  expect(readIdempotencyKey(new Headers())).toBeUndefined()
  expect(readIdempotencyKey(new Headers({ 'Idempotency-Key': ' k1 ' }))).toBe('k1')
  expect(() => readIdempotencyKey(new Headers({ 'Idempotency-Key': 'k'.repeat(257) }))).toThrow(
    expect.objectContaining({ code: 'validation_error', status: 400 }),
  )
})
