import { eq } from 'drizzle-orm'
import { beforeEach, expect, it } from 'vitest'
import type { Executor } from '../src/client'
import { newId } from '../src/ids'
import { purgeExpiredWebhookDeliveries } from '../src/repositories/retention-webhooks'
import { webhookAttempts, webhookDeliveries, webhookEndpoints, workspaces } from '../src/schema'
import { createTestConnection, createTestWorkspace, describeDb } from '../src/testing'

const HOUR = 3600
const ago = (seconds: number) => new Date(Date.now() - seconds * 1000)

async function endpoint(db: Executor, workspaceId: string, connectionId: string | null) {
  const id = newId('whe')
  await db.insert(webhookEndpoints).values({
    id,
    workspaceId,
    connectionId,
    url: 'https://hooks.example/x',
    payloadFormat: 'unified',
    events: ['email.sent'],
    secret: 's',
  })
  return id
}

type Status = 'pending' | 'retrying' | 'succeeded' | 'failed'

async function delivery(
  db: Executor,
  workspaceId: string,
  endpointId: string,
  ageSeconds: number,
  status: Status = 'succeeded',
) {
  const id = newId('whd')
  await db.insert(webhookDeliveries).values({
    id,
    workspaceId,
    endpointId,
    payloadFormat: 'unified',
    canonicalEvent: 'email.sent',
    dialectEvent: 'email.sent',
    body: '{}',
    status,
    createdAt: ago(ageSeconds),
  })
  await db
    .insert(webhookAttempts)
    .values({ id: newId('wha'), deliveryId: id, attemptNo: 1, requestHeaders: {}, durationMs: 1 })
  return id
}

describeDb('webhook delivery retention', (ctx) => {
  beforeEach(async () => {
    await ctx.db.delete(workspaces)
  })

  it('purges finished deliveries past the retention of their endpoint scope', async () => {
    const ws = await createTestWorkspace(ctx.db, { retentionSeconds: 2 * HOUR })
    const short = await createTestConnection(ctx.db, ws.id, { retentionSeconds: HOUR })
    const inherit = await createTestConnection(ctx.db, ws.id)
    const wide = await endpoint(ctx.db, ws.id, null)
    const narrow = await endpoint(ctx.db, ws.id, short.id)
    const inherited = await endpoint(ctx.db, ws.id, inherit.id)
    const keep = [
      await delivery(ctx.db, ws.id, wide, HOUR),
      await delivery(ctx.db, ws.id, narrow, 30 * 60),
      await delivery(ctx.db, ws.id, inherited, 90 * 60),
      await delivery(ctx.db, ws.id, wide, 3 * HOUR, 'retrying'), // still in flight
      await delivery(ctx.db, ws.id, wide, 3 * HOUR, 'pending'),
    ]
    const drop = [
      await delivery(ctx.db, ws.id, wide, 3 * HOUR),
      await delivery(ctx.db, ws.id, narrow, 90 * 60, 'failed'),
      await delivery(ctx.db, ws.id, inherited, 3 * HOUR),
    ]

    expect(await purgeExpiredWebhookDeliveries(ctx.db)).toBe(drop.length)
    const left = await ctx.db.select({ id: webhookDeliveries.id }).from(webhookDeliveries)
    expect(left.map((r) => r.id).sort()).toEqual([...keep].sort())
    for (const id of drop) {
      const attempts = await ctx.db
        .select()
        .from(webhookAttempts)
        .where(eq(webhookAttempts.deliveryId, id))
      expect(attempts).toEqual([])
    }
    expect(await purgeExpiredWebhookDeliveries(ctx.db)).toBe(0)
  })
})
