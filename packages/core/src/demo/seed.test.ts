import { attachments, messageRecipients, messages, suppressions } from '@mailsink/db'
import { createTestConnection, createTestWorkspace, describeDb } from '@mailsink/db/testing'
import { asc, eq, inArray } from 'drizzle-orm'
import { expect, it } from 'vitest'
import { createEventBus, type StreamFrame } from '../events/bus'
import { simulateDelivery } from '../simulation/simulate-delivery'
import { demoMessages } from './catalog'
import { seedDemoMessages } from './seed'

const NOW = new Date('2026-11-23T10:00:00Z')

describeDb('demo messages', (ctx) => {
  const bus = createEventBus()
  const deps = () => ({ db: ctx.db, maxMessageBytes: 1024 * 1024, bus })

  it('stores the set through the pipeline, spread over the connections, oldest first', async () => {
    const ws = (await createTestWorkspace(ctx.db)).id
    const resend = await createTestConnection(ctx.db, ws)
    const smtp = await createTestConnection(ctx.db, ws, {
      name: 'SMTP',
      kind: 'smtp',
      smtpUsername: 'demo-user',
      smtpPasswordHash: 'x',
    })
    await createTestConnection(ctx.db, ws, { name: 'Off', disabledAt: NOW })
    const frames: StreamFrame[] = []
    const off = bus.subscribe(ws, (frame) => frames.push(frame))
    const result = await seedDemoMessages(deps(), ws, 'fr', NOW)
    off()
    expect(result.count).toBe(8)
    const rows = await ctx.db
      .select()
      .from(messages)
      .where(eq(messages.workspaceId, ws))
      .orderBy(asc(messages.createdAt))
    expect(rows.map((m) => m.id)).toEqual(result.messageIds)
    expect(rows.map((m) => m.connectionId)).toEqual(
      Array.from({ length: 8 }, (_, i) => (i % 2 === 0 ? resend.id : smtp.id)),
    )
    expect(rows.map((m) => m.source)).toContain('smtp')
    expect(rows[0]?.subject).toBe('Bienvenue sur Fieldnote, Jeanne')
    expect(rows[0]?.createdAt.getTime()).toBe(NOW.getTime() - 52 * 60_000)
    expect(rows.every((m) => m.rawBlobId && (m.links?.length ?? 0) > 0)).toBe(true)
    const files = await ctx.db
      .select({ filename: attachments.filename, disposition: attachments.disposition })
      .from(attachments)
      .where(inArray(attachments.messageId, result.messageIds))
    expect(files.map((f) => f.filename).sort()).toEqual([
      'INV-2026-0142.pdf',
      'logo.png',
      'usage-2026-11.csv',
    ])
    expect(files.find((f) => f.filename === 'logo.png')?.disposition).toBe('inline')
    expect(frames.filter((f) => f.event.type === 'message.created')).toHaveLength(8)
  })

  it('gives each recipient its planned status, whatever the workspace settings', async () => {
    const ws = (
      await createTestWorkspace(ctx.db, {
        simulation: {
          rates: { failed: 100 },
          rules: [],
          latency: { minMs: 0, maxMs: 0 },
          openRate: 0,
          clickRate: 0,
        },
      })
    ).id
    const { messageIds } = await seedDemoMessages(deps(), ws, 'en', NOW)
    for (const id of messageIds) await simulateDelivery(ctx.db, id, { now: () => NOW.getTime() })
    const statuses = await ctx.db
      .select({ email: messageRecipients.email, status: messageRecipients.status })
      .from(messageRecipients)
      .where(eq(messageRecipients.workspaceId, ws))
    const by = Object.fromEntries(statuses.map((r) => [r.email, r.status]))
    expect(by).toMatchObject({
      'jane.doe@example.test': 'delivered',
      'no-such-user@bounce.example.test': 'hard_bounce',
      'orders@acme.example.test': 'delivered',
      'sarah.k@mail.example.test': 'complained',
      'full.mailbox@example.test': 'soft_bounce',
      'finance@acme.example.test': 'failed',
    })
    const listed = await ctx.db
      .select({ email: suppressions.email })
      .from(suppressions)
      .where(eq(suppressions.workspaceId, ws))
    expect(listed.map((s) => s.email).sort()).toEqual([
      'no-such-user@bounce.example.test',
      'sarah.k@mail.example.test',
    ])
  })

  it('exists in English and French with the same structure', () => {
    const [en, fr] = [demoMessages('en'), demoMessages('fr')]
    expect(en.map((m) => m.email.to)).toEqual(fr.map((m) => m.email.to))
    expect(en[0]?.email.subject).toBe('Welcome to Fieldnote, Jane')
    expect(en.every((m, i) => m.email.subject !== fr[i]?.email.subject)).toBe(true)
  })
})
