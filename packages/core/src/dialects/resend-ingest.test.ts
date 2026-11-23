import { messages } from '@mailsink/db'
import { createTestMessage, describeDb } from '@mailsink/db/testing'
import { eq } from 'drizzle-orm'
import { beforeAll, expect, it } from 'vitest'
import { isDomainError } from '../errors'
import type { IngestTarget } from '../ingestion/normalize'
import { seedTarget } from '../ingestion/testing/fixtures'
import { readResendIdempotencyKey, sendResendBatch, sendResendEmail } from './resend-ingest'
import { getResendEmail, resendTimestamp } from './resend-read'

const MAX = 16 * 1024
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const email = (patch: Record<string, unknown> = {}) => ({
  from: 'Acme <app@x.io>',
  to: ['Jane <jane@x.io>'],
  subject: 'Welcome',
  html: '<p>Hi</p>',
  ...patch,
})

async function refusal(promise: Promise<unknown>) {
  try {
    await promise
  } catch (error) {
    if (isDomainError(error))
      return { status: error.status, message: error.message, details: error.details }
    throw error
  }
  throw new Error('expected a refusal')
}

describeDb('Resend ingestion', (ctx) => {
  let target: IngestTarget
  beforeAll(async () => {
    target = { ...(await seedTarget(ctx.db)), source: 'resend' }
  })
  const deps = () => ({ db: ctx.db, maxMessageBytes: MAX })
  const rowsOf = (workspaceId: string) =>
    ctx.db.select().from(messages).where(eq(messages.workspaceId, workspaceId))

  it('stores the email with source resend and answers its uuid', async () => {
    const { response } = await sendResendEmail(deps(), target, email({ cc: 'bob@x.io' }))
    const { id } = response.body as { id: string }
    expect(response.status).toBe(200)
    expect(id).toMatch(UUID)
    const [row] = await ctx.db
      .select()
      .from(messages)
      .where(eq(messages.id, `msg_${id}`))
    expect(row).toMatchObject({ source: 'resend', providerMessageId: id })

    const read = await getResendEmail(ctx.db, target.workspaceId, id.toUpperCase())
    expect(read).toMatchObject({
      object: 'email',
      id,
      message_id: `<msg_${id}@mailsink>`,
      from: 'Acme <app@x.io>',
      to: ['Jane <jane@x.io>'],
      cc: ['bob@x.io'],
      bcc: [],
      reply_to: [],
      last_event: 'queued',
      scheduled_at: null,
      html: '<p>Hi</p>',
      text: null,
    })
    expect(read.created_at).toBe(resendTimestamp(row?.createdAt ?? new Date()))
  })

  it('GET answers the Message-ID an SMTP message carried itself', async () => {
    const id = '0190c9a4-0000-7000-8000-00000000abcd'
    await createTestMessage(ctx.db, target.workspaceId, {
      id: `msg_${id}`,
      source: 'smtp',
      headers: { 'message-id': '<own-123@client.example>' },
    })
    const read = await getResendEmail(ctx.db, target.workspaceId, id)
    expect(read.message_id).toBe('<own-123@client.example>')
  })

  it('GET answers invalid_parameter and not_found', async () => {
    expect(await refusal(getResendEmail(ctx.db, target.workspaceId, 'nope'))).toMatchObject({
      status: 422,
      details: { resend: 'invalid_parameter' },
    })
    const unknown = '0190c9a4-0000-7000-8000-000000000000'
    expect(await refusal(getResendEmail(ctx.db, target.workspaceId, unknown))).toMatchObject({
      status: 404,
    })
  })

  it('strict batch stores everything or nothing', async () => {
    const other = { ...(await seedTarget(ctx.db)), source: 'resend' as const }
    const refused = await refusal(
      sendResendBatch(deps(), other, [email(), email({ to: 'bad' })], 'strict'),
    )
    expect(refused).toMatchObject({ status: 400 })
    expect(refused.message).toMatch(/^emails\[1\]: Invalid `to` field\./)
    expect(await rowsOf(other.workspaceId)).toHaveLength(0)

    const { response } = await sendResendBatch(deps(), other, [email(), email()], 'strict')
    expect(response.body).toEqual({
      data: [{ id: expect.stringMatching(UUID) }, { id: expect.stringMatching(UUID) }],
    })
    expect(await rowsOf(other.workspaceId)).toHaveLength(2)
  })

  it('permissive batch stores the valid items and lists the others', async () => {
    const other = { ...(await seedTarget(ctx.db)), source: 'resend' as const }
    const items = [email(), email({ subject: undefined }), email({ html: 'z'.repeat(MAX) })]
    const { response } = await sendResendBatch(deps(), other, items, 'permissive')
    const body = response.body as { data: unknown[]; errors: { index: number }[] }
    expect(response.status).toBe(200)
    expect(body.data).toHaveLength(1)
    expect(body.errors).toEqual([
      { index: 1, message: 'Missing `subject` field.' },
      { index: 2, message: expect.stringContaining('bytes limit') },
    ])
    expect(await rowsOf(other.workspaceId)).toHaveLength(1)
  })

  it('refuses an empty or oversized batch envelope', async () => {
    expect(await refusal(sendResendBatch(deps(), target, [], 'strict'))).toMatchObject({
      status: 400,
    })
    expect(await refusal(sendResendBatch(deps(), target, {}, 'strict'))).toMatchObject({
      status: 400,
    })
  })

  it('replays an idempotent request and refuses another body', async () => {
    const first = await sendResendEmail(deps(), target, email(), 'resend-key-1')
    const again = await sendResendEmail(deps(), target, email(), 'resend-key-1')
    expect(again.replayed).toBe(true)
    expect(again.response.body).toEqual(first.response.body)
    expect(
      await refusal(sendResendEmail(deps(), target, email({ subject: 'x' }), 'resend-key-1')),
    ).toMatchObject({ status: 409 })
  })

  it('reads the Idempotency-Key header with the Resend refusal', async () => {
    expect(readResendIdempotencyKey(new Headers({ 'idempotency-key': 'abc' }))).toBe('abc')
    const long = new Headers({ 'idempotency-key': 'k'.repeat(257) })
    expect(() => readResendIdempotencyKey(long)).toThrow(/between 1 and 256/)
  })
})
