import { jobs, messageEvents, messageRecipients, messages } from '@mailsink/db'
import { createTestWorkspace, describeDb } from '@mailsink/db/testing'
import { sql } from 'drizzle-orm'
import { expect, it } from 'vitest'
import { insertQueuedMessage } from '../simulation/testing/fixtures'
import { simulateDeliveryHandler } from './handlers/simulate'
import { createJobRunner } from './queue'

const MESSAGES = 40

describeDb('two workers on one queue', (ctx) => {
  it('simulates every message exactly once', async () => {
    const workspaceId = (await createTestWorkspace(ctx.db)).id
    for (let i = 0; i < MESSAGES; i += 1) {
      await insertQueuedMessage(ctx.db, workspaceId, [
        { email: `a${i}@example.com` },
        { email: `b${i}@example.com` },
      ])
    }
    const worker = () =>
      createJobRunner({
        db: ctx.db,
        handlers: { simulate_delivery: simulateDeliveryHandler() },
        batchSize: 5,
      })
    const [one, two] = [worker(), worker()]
    // Both drain the queue at the same time, small batches so their claims interleave.
    const drain = async (run: ReturnType<typeof worker>) => {
      let total = 0
      for (let n = await run(); n > 0; n = await run()) total += n
      return total
    }
    const [ranByOne, ranByTwo] = await Promise.all([drain(one), drain(two)])

    expect(ranByOne + ranByTwo).toBe(MESSAGES)
    expect(await ctx.db.select().from(jobs)).toEqual([])
    const statuses = await ctx.db
      .select({ status: messages.status, n: sql<number>`count(*)::int` })
      .from(messages)
      .groupBy(messages.status)
    expect(statuses).toEqual([{ status: 'delivered', n: MESSAGES }])
    const delivered = await ctx.db
      .select({ n: sql<number>`count(*)::int` })
      .from(messageRecipients)
      .where(sql`${messageRecipients.status} = 'delivered'`)
    expect(delivered[0]?.n).toBe(2 * MESSAGES)
    // One sent and one delivered event per recipient, never duplicated.
    const perRecipient = await ctx.db
      .select({ n: sql<number>`count(*)::int` })
      .from(messageEvents)
      .groupBy(messageEvents.messageId, messageEvents.recipientEmail, messageEvents.type)
    expect(perRecipient).toHaveLength(2 * 2 * MESSAGES)
    expect(perRecipient.every((r) => r.n === 1)).toBe(true)
  })
})
