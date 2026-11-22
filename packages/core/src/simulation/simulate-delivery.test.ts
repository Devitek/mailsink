import { messageEvents, messageRecipients, messages } from '@mailsink/db'
import { describeDb } from '@mailsink/db/testing'
import { asc, eq } from 'drizzle-orm'
import { beforeEach, expect, it } from 'vitest'
import { simulateDelivery } from './simulate-delivery'
import { insertQueuedMessage, insertWorkspace } from './testing/fixtures'

describeDb('simulateDelivery', (ctx) => {
  let workspaceId = ''

  beforeEach(async () => {
    workspaceId = await insertWorkspace(ctx.db)
  })

  const state = async (messageId: string) => {
    const [message] = await ctx.db.select().from(messages).where(eq(messages.id, messageId))
    const recipients = await ctx.db
      .select({ email: messageRecipients.email, status: messageRecipients.status })
      .from(messageRecipients)
      .where(eq(messageRecipients.messageId, messageId))
      .orderBy(asc(messageRecipients.email))
    const events = await ctx.db
      .select()
      .from(messageEvents)
      .where(eq(messageEvents.messageId, messageId))
      .orderBy(asc(messageEvents.occurredAt), asc(messageEvents.id))
    return { message, recipients, events }
  }

  it('moves each queued recipient through sent to delivered', async () => {
    const id = await insertQueuedMessage(ctx.db, workspaceId, [
      { email: 'a@example.com' },
      { email: 'b@example.com' },
    ])
    const result = await simulateDelivery(ctx.db, id)
    expect(result).toMatchObject({ kind: 'done', messageStatus: 'delivered' })

    const { message, recipients, events } = await state(id)
    expect(message?.status).toBe('delivered')
    expect(recipients.map((r) => r.status)).toEqual(['delivered', 'delivered'])
    expect(events.every((e) => e.origin === 'simulation' && e.workspaceId === workspaceId)).toBe(
      true,
    )
    for (const email of ['a@example.com', 'b@example.com']) {
      const mine = events.filter((e) => e.recipientEmail === email)
      expect(mine.map((e) => e.type)).toEqual(['sent', 'delivered'])
      expect(mine[0]?.occurredAt.getTime()).toBeLessThan(mine[1]?.occurredAt.getTime() ?? 0)
    }
  })

  it('skips suppressed recipients and keeps them out of the events', async () => {
    const id = await insertQueuedMessage(ctx.db, workspaceId, [
      { email: 'gone@example.com', status: 'suppressed' },
      { email: 'ok@example.com' },
    ])
    await simulateDelivery(ctx.db, id)
    const { message, recipients, events } = await state(id)
    expect(recipients).toEqual([
      { email: 'gone@example.com', status: 'suppressed' },
      { email: 'ok@example.com', status: 'delivered' },
    ])
    expect(events.map((e) => e.recipientEmail)).not.toContain('gone@example.com')
    expect(message?.status).toBe('delivered')
  })

  it('leaves a fully suppressed message suppressed without events', async () => {
    const id = await insertQueuedMessage(ctx.db, workspaceId, [
      { email: 'gone@example.com', status: 'suppressed' },
    ])
    expect(await simulateDelivery(ctx.db, id)).toMatchObject({ messageStatus: 'suppressed' })
    const { message, events } = await state(id)
    expect(message?.status).toBe('suppressed')
    expect(events).toEqual([])
  })

  it('is idempotent: a replay writes nothing more', async () => {
    const id = await insertQueuedMessage(ctx.db, workspaceId, [{ email: 'a@example.com' }])
    await simulateDelivery(ctx.db, id)
    const replay = await simulateDelivery(ctx.db, id)
    expect(replay).toMatchObject({ kind: 'done', transitions: [] })
    expect((await state(id)).events).toHaveLength(2)
  })

  it('reports a message that no longer exists', async () => {
    expect(await simulateDelivery(ctx.db, 'msg_missing')).toEqual({ kind: 'missing' })
  })

  it('applies the outcomes of a custom planner', async () => {
    const id = await insertQueuedMessage(ctx.db, workspaceId, [{ email: 'a@example.com' }])
    await simulateDelivery(ctx.db, id, {
      planner: async ({ recipients }) =>
        recipients.map((r) => ({ recipientId: r.id, status: 'soft_bounce', reason: 'rule x' })),
    })
    const { message, events } = await state(id)
    expect(message?.status).toBe('soft_bounce')
    expect(events.map((e) => [e.type, e.data])).toEqual([
      ['sent', null],
      ['soft_bounce', { reason: 'rule x' }],
    ])
  })
})
