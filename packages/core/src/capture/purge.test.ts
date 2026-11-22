import { PurgeQuery } from '@mailsink/contracts'
import {
  apiLogs,
  blobs,
  type Database,
  messageEvents,
  messages,
  newId,
  smtpSessions,
  webhookDeliveries,
  webhookEndpoints,
} from '@mailsink/db'
import { describeDb } from '@mailsink/db/testing'
import { eq } from 'drizzle-orm'
import { expect, it } from 'vitest'
import { purgeCapturedMessages } from './service'
import { insertCapturedMessage, insertCaptureWorkspace } from './testing/fixtures'

const OLD = new Date('2026-11-01T00:00:00Z')
const NEW = new Date('2026-11-20T00:00:00Z')
const CUTOFF = '2026-11-10T00:00:00Z'

async function seed(db: Database) {
  const { workspace, connection } = await insertCaptureWorkspace(db)
  const ws = workspace.id
  const con = connection.id
  const event = { type: 'accepted' as const, origin: 'api' as const }
  const oldCon = await insertCapturedMessage(db, ws, {
    connectionId: con,
    createdAt: OLD,
    raw: 'raw',
    events: [event],
    attachments: [{ contentType: 'text/plain', content: 'a' }],
  })
  const oldSmtp = await insertCapturedMessage(db, ws, { createdAt: OLD })
  const recent = await insertCapturedMessage(db, ws, { connectionId: con, createdAt: NEW })
  const [endpoint] = await db
    .insert(webhookEndpoints)
    .values({
      id: newId('whe'),
      workspaceId: ws,
      url: 'https://hooks.test/x',
      payloadFormat: 'unified',
      events: ['email.sent'],
      secret: 'whsec_x',
    })
    .returning()
  const delivery = (messageId: string) => ({
    id: newId('whd'),
    workspaceId: ws,
    endpointId: endpoint?.id ?? '',
    messageId,
    payloadFormat: 'unified' as const,
    canonicalEvent: 'email.sent' as const,
    dialectEvent: 'email.sent',
    body: '{}',
  })
  await db.insert(webhookDeliveries).values([delivery(oldCon.id), delivery(recent.id)])
  const log = (connectionId: string | null, createdAt: Date) => ({
    id: newId('req'),
    workspaceId: ws,
    connectionId,
    dialect: 'native' as const,
    method: 'POST',
    path: '/v1/emails',
    statusCode: 200,
    durationMs: 1,
    createdAt,
  })
  await db.insert(apiLogs).values([log(con, OLD), log(null, OLD), log(con, NEW)])
  await db.insert(smtpSessions).values({
    id: newId('smtp'),
    workspaceId: ws,
    remoteAddress: '127.0.0.1',
    transcript: [],
    outcome: 'accepted',
    startedAt: OLD,
  })
  return { ws, con, oldCon, oldSmtp, recent }
}

const count = async (db: Database, table: typeof apiLogs | typeof smtpSessions, ws: string) =>
  (await db.select().from(table).where(eq(table.workspaceId, ws))).length

describeDb('capture: purge', (ctx) => {
  const purge = (ws: string, q: Record<string, unknown>) =>
    purgeCapturedMessages(ctx.db, ws, PurgeQuery.parse(q))
  const remaining = async (ws: string) =>
    (await ctx.db.select().from(messages).where(eq(messages.workspaceId, ws))).map((m) => m.id)

  it('purges a connection before a date, with its logs and webhook deliveries', async () => {
    const s = await seed(ctx.db)
    expect(await purge(s.ws, { connectionId: s.con, before: CUTOFF })).toEqual({ count: 1 })
    expect((await remaining(s.ws)).sort()).toEqual([s.oldSmtp.id, s.recent.id].sort())
    // Cascades: events of the purged message are gone.
    expect(
      await ctx.db.select().from(messageEvents).where(eq(messageEvents.messageId, s.oldCon.id)),
    ).toEqual([])
    const deliveries = await ctx.db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.workspaceId, s.ws))
    expect(deliveries.map((d) => d.messageId)).toEqual([s.recent.id])
    expect(await count(ctx.db, apiLogs, s.ws)).toBe(2) // other connection + recent one
    expect(await count(ctx.db, smtpSessions, s.ws)).toBe(1) // no connection: out of scope
    // Blobs stay for the retention job (doc 02).
    expect((await ctx.db.select().from(blobs).where(eq(blobs.workspaceId, s.ws))).length).toBe(2)
  })

  it('keeps logs and deliveries with includeLogs=false', async () => {
    const s = await seed(ctx.db)
    expect(await purge(s.ws, { includeLogs: 'false' })).toEqual({ count: 3 })
    expect(await remaining(s.ws)).toEqual([])
    expect(await count(ctx.db, apiLogs, s.ws)).toBe(3)
    expect(await count(ctx.db, smtpSessions, s.ws)).toBe(1)
    const deliveries = await ctx.db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.workspaceId, s.ws))
    expect(deliveries.map((d) => d.messageId)).toEqual([null, null])
  })

  it('purges everything of the workspace by default, and nothing of another one', async () => {
    const a = await seed(ctx.db)
    const b = await seed(ctx.db)
    expect(await purge(a.ws, {})).toEqual({ count: 3 })
    expect(await count(ctx.db, apiLogs, a.ws)).toBe(0)
    expect(await count(ctx.db, smtpSessions, a.ws)).toBe(0)
    expect((await remaining(b.ws)).length).toBe(3)
    expect(await count(ctx.db, apiLogs, b.ws)).toBe(3)
    // A connection id of workspace B purges nothing in workspace A.
    expect(await purge(a.ws, { connectionId: b.con })).toEqual({ count: 0 })
    expect((await remaining(b.ws)).length).toBe(3)
  })
})
