import {
  BrevoBlockedContactsQuery,
  BrevoListEmailsQuery,
  BrevoSendRequest,
  type BrevoSendRequestInput,
} from '@mailsink/contracts'
import { messages, suppressions } from '@mailsink/db'
import { createTestConnection, createTestSuppression, describeDb } from '@mailsink/db/testing'
import { eq } from 'drizzle-orm'
import { beforeAll, expect, it } from 'vitest'
import type { IngestTarget } from '../../ingestion/normalize'
import { seedTarget } from '../../ingestion/testing/fixtures'
import { listBrevoBlockedContacts, listBrevoEmails, unblockBrevoContact } from './read'
import { sendBrevoEmail } from './send'

describeDb('Brevo dialect: read routes', (ctx) => {
  let target: IngestTarget
  let other: IngestTarget
  const ids: string[] = []
  const send = async (on: IngestTarget, input: Partial<BrevoSendRequestInput>) => {
    const { response } = await sendBrevoEmail(
      { db: ctx.db, maxMessageBytes: 1 << 20 },
      on,
      BrevoSendRequest.parse({
        sender: { email: 'shop@acme.test' },
        to: [{ email: 'jane@acme.test' }],
        subject: 'Order',
        textContent: 'x',
        ...input,
      }),
    )
    return (response.body as { messageId: string }).messageId
  }
  const list = (q: Record<string, unknown>) =>
    listBrevoEmails(
      ctx.db,
      { workspaceId: target.workspaceId, connectionId: target.connectionId ?? '' },
      BrevoListEmailsQuery.parse(q),
    )

  beforeAll(async () => {
    target = { ...(await seedTarget(ctx.db)), source: 'brevo' }
    const con = await createTestConnection(ctx.db, target.workspaceId, {
      kind: 'brevo',
      name: 'B2',
    })
    other = { ...target, connectionId: con.id }
    ids.push(await send(target, { tags: ['order'], cc: [{ email: 'boss@acme.test' }] }))
    ids.push(await send(target, { subject: 'Second' }))
    await send(other, { subject: 'Other connection' })
    const old = await send(target, { subject: 'Old' })
    await ctx.db
      .update(messages)
      .set({ createdAt: new Date('2026-01-10T12:00:00Z') })
      .where(eq(messages.providerMessageId, old))
  })

  it('lists the copies of the connection, newest first, with tags and the total', async () => {
    const page = await list({ email: 'jane@acme.test' })
    expect(page.count).toBe(2)
    expect(page.transactionalEmails.map((e) => e.subject)).toEqual(['Second', 'Order'])
    expect(page.transactionalEmails[1]).toEqual({
      email: 'jane@acme.test',
      subject: 'Order',
      messageId: ids[0],
      uuid: expect.stringMatching(/^[0-9a-f-]{36}$/),
      date: expect.stringMatching(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/),
      from: 'shop@acme.test',
      tags: ['order'],
    })
    const byId = await list({ messageId: ids[0]?.slice(1, -1), sort: 'asc' })
    expect(byId.transactionalEmails.map((e) => e.email)).toEqual([
      'jane@acme.test',
      'boss@acme.test',
    ])
    const paged = await list({ email: 'jane@acme.test', limit: 1, offset: 1 })
    expect(paged).toMatchObject({ count: 2, transactionalEmails: [{ subject: 'Order' }] })
  })

  it('filters by day range and template', async () => {
    const jan = await list({
      email: 'jane@acme.test',
      startDate: '2026-01-10',
      endDate: '2026-01-10',
    })
    expect(jan.transactionalEmails.map((e) => e.subject)).toEqual(['Old'])
    // 2026-01-10T12:00Z is already 2026-01-11 in Kiritimati (UTC+14, D284).
    const kiritimati = await listBrevoEmails(
      ctx.db,
      { workspaceId: target.workspaceId, connectionId: target.connectionId ?? '' },
      BrevoListEmailsQuery.parse({
        email: 'jane@acme.test',
        startDate: '2026-01-11',
        endDate: '2026-01-11',
      }),
      { timeZone: 'Pacific/Kiritimati' },
    )
    expect(kiritimati.transactionalEmails.map((e) => e.subject)).toEqual(['Old'])
    expect(await list({ templateId: 9 })).toEqual({ count: 0, transactionalEmails: [] })
  })

  it('reads the suppression list as blocked contacts, then unblocks one', async () => {
    const ws = target.workspaceId
    const [message] = await ctx.db
      .select({ id: messages.id })
      .from(messages)
      .where(eq(messages.providerMessageId, ids[0] ?? ''))
    await createTestSuppression(ctx.db, ws, 'gone@acme.test', 'hard_bounce', message?.id)
    await createTestSuppression(ctx.db, ws, 'spam@acme.test', 'complained')
    const manual = await createTestSuppression(ctx.db, ws, 'admin@acme.test', 'manual')
    await ctx.db
      .update(suppressions)
      .set({ createdAt: new Date('2026-01-05T00:00:00Z') })
      .where(eq(suppressions.id, manual.id))
    const blocked = (q: Record<string, unknown>) =>
      listBrevoBlockedContacts(ctx.db, ws, BrevoBlockedContactsQuery.parse(q))

    const all = await blocked({})
    expect(all.count).toBe(3)
    expect(all.contacts.map((c) => c.email)).toEqual([
      'admin@acme.test',
      'spam@acme.test',
      'gone@acme.test',
    ])
    expect(all.contacts[2]).toEqual({
      email: 'gone@acme.test',
      senderEmail: 'shop@acme.test',
      reason: { code: 'hardBounce', message: 'Hard bounce' },
      blockedAt: expect.stringMatching(/Z$/),
    })
    expect((await blocked({ senders: 'Shop@acme.test' })).contacts).toHaveLength(1)
    expect((await blocked({ startDate: '2026-01-01', endDate: '2026-01-31' })).contacts).toEqual([
      expect.objectContaining({ reason: { code: 'adminBlocked', message: 'Admin blocked' } }),
    ])
    // Days of the workspace timezone (D284): 2026-01-05T00:00Z is 2026-01-04 in New York.
    const day = BrevoBlockedContactsQuery.parse({ startDate: '2026-01-04', endDate: '2026-01-04' })
    expect((await listBrevoBlockedContacts(ctx.db, ws, day)).count).toBe(0)
    const newYork = await listBrevoBlockedContacts(ctx.db, ws, day, {
      timeZone: 'America/New_York',
    })
    expect(newYork.contacts.map((c) => c.email)).toEqual(['admin@acme.test'])
    const late = { now: new Date('2026-11-24T23:30:00Z') }
    const tomorrow = BrevoBlockedContactsQuery.parse({
      startDate: '2026-11-25',
      endDate: '2026-11-25',
    })
    await expect(listBrevoBlockedContacts(ctx.db, ws, tomorrow, late)).rejects.toMatchObject({
      code: 'validation_error',
    })
    await expect(
      listBrevoBlockedContacts(ctx.db, ws, tomorrow, { ...late, timeZone: 'Europe/Paris' }),
    ).resolves.toMatchObject({ count: 0 })
    expect(await blocked({ sort: 'asc', limit: 1, offset: 1 })).toMatchObject({
      count: 3,
      contacts: [{ email: 'spam@acme.test' }],
    })

    await unblockBrevoContact(ctx.db, ws, 'spam@acme.test')
    await expect(unblockBrevoContact(ctx.db, ws, 'spam@acme.test')).rejects.toMatchObject({
      code: 'not_found',
    })
    expect((await blocked({})).count).toBe(2)
  })
})
