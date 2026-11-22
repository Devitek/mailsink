import { SendEmailRequest } from '@mailsink/contracts'
import { attachments, blobs, jobs, messageEvents, messageRecipients, messages } from '@mailsink/db'
import { createTestSuppression, describeDb } from '@mailsink/db/testing'
import { eq } from 'drizzle-orm'
import { beforeAll, expect, it } from 'vitest'
import { sendNativeEmail } from './native'
import type { IngestTarget } from './normalize'
import { sampleRequest, seedTarget } from './testing/fixtures'

const MAX = 64 * 1024
const b64 = (s: string) => Buffer.from(s).toString('base64')

describeDb('ingestion pipeline', (ctx) => {
  let target: IngestTarget
  beforeAll(async () => {
    target = await seedTarget(ctx.db)
  })
  const send = (patch: Parameters<typeof sampleRequest>[0] = {}) =>
    sendNativeEmail(
      { db: ctx.db, maxMessageBytes: MAX },
      target,
      SendEmailRequest.parse(sampleRequest(patch)),
    )

  it('stores a queued message, its recipients, raw EML, links, event and job', async () => {
    const { response } = await send({
      cc: 'Copy <cc@x.io>',
      bcc: ['jane@x.io', 'b@x.io'],
      metadata: { a: 1 },
    })
    expect(response.status).toBe(200)
    const { id, status } = response.body as { id: string; status: string }
    expect(status).toBe('queued')
    const [message] = await ctx.db.select().from(messages).where(eq(messages.id, id))
    expect(message).toMatchObject({
      workspaceId: target.workspaceId,
      connectionId: target.connectionId,
      source: 'native',
      providerMessageId: id,
      status: 'queued',
      subject: 'Welcome',
      metadata: { a: 1 },
      links: [{ url: 'https://app.io/confirm', text: 'confirm' }],
    })
    const [raw] = await ctx.db
      .select()
      .from(blobs)
      .where(eq(blobs.id, message?.rawBlobId ?? ''))
    expect(Buffer.from(raw?.data ?? []).toString()).toContain(`Message-ID: <${id}@mailsink>`)
    expect(message?.sizeBytes).toBe(raw?.sizeBytes)
    const recipients = await ctx.db
      .select()
      .from(messageRecipients)
      .where(eq(messageRecipients.messageId, id))
    expect(recipients.map((r) => [r.kind, r.email, r.name, r.status])).toEqual([
      ['to', 'jane@x.io', null, 'queued'],
      ['cc', 'cc@x.io', 'Copy', 'queued'],
      ['bcc', 'b@x.io', null, 'queued'],
    ])
    const events = await ctx.db.select().from(messageEvents).where(eq(messageEvents.messageId, id))
    expect(events.map((e) => [e.type, e.origin, e.recipientEmail])).toEqual([
      ['accepted', 'simulation', null],
    ])
    const queued = await ctx.db.select().from(jobs).where(eq(jobs.workspaceId, target.workspaceId))
    expect(queued.find((j) => (j.payload as { messageId: string }).messageId === id)).toMatchObject(
      {
        kind: 'simulate_delivery',
        payload: { messageId: id },
      },
    )
  })

  it('stores attachments as deduplicated blobs', async () => {
    const files = [
      { filename: 'a.txt', content: b64('same bytes') },
      { filename: 'b.txt', content: b64('same bytes') },
      { filename: 'logo.png', content: b64('png'), contentId: 'logo' },
    ]
    const first = (await send({ attachments: files })).response.body as { id: string }
    const second = (await send({ attachments: files })).response.body as { id: string }
    const rows = await ctx.db.select().from(attachments)
    const of = (id: string) => rows.filter((r) => r.messageId === id)
    expect(
      of(first.id).map((r) => [r.filename, r.contentType, r.disposition, r.sizeBytes]),
    ).toEqual([
      ['a.txt', 'text/plain', 'attachment', 10],
      ['b.txt', 'text/plain', 'attachment', 10],
      ['logo.png', 'image/png', 'inline', 3],
    ])
    expect(new Set(rows.map((r) => r.blobId)).size).toBe(2)
    expect(of(second.id).map((r) => r.blobId)).toEqual(of(first.id).map((r) => r.blobId))
  })

  it('marks suppressed recipients and skips the job when nobody is left', async () => {
    await createTestSuppression(ctx.db, target.workspaceId, 'gone@x.io')
    const partial = (await send({ to: ['gone@x.io', 'ok@x.io'] })).response.body as {
      id: string
      status: string
    }
    expect(partial.status).toBe('queued')
    const recipients = await ctx.db
      .select()
      .from(messageRecipients)
      .where(eq(messageRecipients.messageId, partial.id))
    expect(recipients.map((r) => [r.email, r.status])).toEqual([
      ['gone@x.io', 'suppressed'],
      ['ok@x.io', 'queued'],
    ])
    const events = await ctx.db
      .select()
      .from(messageEvents)
      .where(eq(messageEvents.messageId, partial.id))
    expect(events.map((e) => [e.type, e.recipientEmail])).toEqual([
      ['accepted', null],
      ['suppressed', 'gone@x.io'],
    ])

    const none = (await send({ to: 'Gone@X.io' })).response.body as { id: string; status: string }
    expect(none.status).toBe('suppressed')
    const [message] = await ctx.db.select().from(messages).where(eq(messages.id, none.id))
    expect(message?.status).toBe('suppressed')
    const queued = await ctx.db.select().from(jobs)
    expect(queued.some((j) => (j.payload as { messageId: string }).messageId === none.id)).toBe(
      false,
    )
  })

  it('rejects a message above the size cap with payload_too_large', async () => {
    const big = b64('x'.repeat(MAX))
    await expect(
      send({ attachments: [{ filename: 'big.bin', content: big }] }),
    ).rejects.toMatchObject({
      code: 'payload_too_large',
      status: 413,
    })
    await expect(send({ html: 'y'.repeat(MAX) })).rejects.toMatchObject({
      code: 'payload_too_large',
    })
  })
})
