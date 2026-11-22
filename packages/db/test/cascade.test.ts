import { count, eq } from 'drizzle-orm'
import type { PgTable } from 'drizzle-orm/pg-core'
import { expect, it } from 'vitest'
import type { Database } from '../src/client'
import { newId } from '../src/ids'
import {
  apiKeys,
  attachments,
  blobs,
  connections,
  messageEvents,
  messageRecipients,
  messages,
  overrides,
  webhookDeliveries,
  webhookEndpoints,
  workspaces,
} from '../src/schema'
import {
  createTestConnection,
  createTestMessage,
  createTestWorkspace,
  describeDb,
} from '../src/testing'

async function rows(db: Database, table: PgTable): Promise<number> {
  const [result] = await db.select({ n: count() }).from(table)
  return result?.n ?? 0
}

async function seedWorkspace(db: Database): Promise<string> {
  const ws = await createTestWorkspace(db, { ephemeral: true, idleTtlSeconds: 60 })
  const con = await createTestConnection(db, ws.id)
  await db.insert(apiKeys).values({
    id: newId('key'),
    workspaceId: ws.id,
    connectionId: con.id,
    scope: 'connection',
    displayPrefix: 'msk_live_3f9a',
    hash: newId('hash'),
  })
  await db
    .insert(overrides)
    .values({ id: newId('ovr'), workspaceId: ws.id, config: { rates: {} }, activatedVia: 'api' })
  const blobId = newId('blob')
  await db.insert(blobs).values({
    id: blobId,
    workspaceId: ws.id,
    sha256: newId('sha'),
    sizeBytes: 3,
    data: new Uint8Array([1, 2, 3]),
  })
  const msg = await createTestMessage(db, ws.id, { connectionId: con.id, rawBlobId: blobId })
  await db.insert(messageRecipients).values({
    id: newId('rcp'),
    messageId: msg.id,
    workspaceId: ws.id,
    kind: 'to',
    email: 'user@example.com',
  })
  await db.insert(attachments).values({
    id: newId('att'),
    messageId: msg.id,
    contentType: 'text/plain',
    disposition: 'attachment',
    sizeBytes: 3,
    blobId,
  })
  const eventId = newId('evt')
  await db.insert(messageEvents).values({
    id: eventId,
    workspaceId: ws.id,
    messageId: msg.id,
    type: 'accepted',
    origin: 'api',
  })
  const endpointId = newId('whe')
  await db.insert(webhookEndpoints).values({
    id: endpointId,
    workspaceId: ws.id,
    url: 'https://hooks.example.com',
    payloadFormat: 'unified',
    events: ['email.delivered'],
    secret: 'whsec_x',
  })
  await db.insert(webhookDeliveries).values({
    id: newId('whd'),
    workspaceId: ws.id,
    endpointId,
    eventId,
    messageId: msg.id,
    payloadFormat: 'unified',
    canonicalEvent: 'email.delivered',
    dialectEvent: 'email.delivered',
    body: '{}',
  })
  return ws.id
}

describeDb('workspace cascade', (ctx) => {
  it('removes every dependent row with a single DELETE', async () => {
    const doomed = await seedWorkspace(ctx.db)
    const kept = await seedWorkspace(ctx.db)
    const tables = [connections, apiKeys, overrides, blobs, messages, messageRecipients]
    const more = [attachments, messageEvents, webhookEndpoints, webhookDeliveries]
    for (const table of [...tables, ...more]) expect(await rows(ctx.db, table)).toBe(2)

    await ctx.db.delete(workspaces).where(eq(workspaces.id, doomed))

    for (const table of [...tables, ...more]) expect(await rows(ctx.db, table)).toBe(1)
    const [left] = await ctx.db.select({ id: workspaces.id }).from(workspaces)
    expect(left?.id).toBe(kept)
  })

  it('round-trips bytea blobs', async () => {
    const ws = await createTestWorkspace(ctx.db)
    const data = new Uint8Array([0, 255, 128, 7])
    const id = newId('blob')
    await ctx.db.insert(blobs).values({ id, workspaceId: ws.id, sha256: 'x', sizeBytes: 4, data })
    const [row] = await ctx.db.select().from(blobs).where(eq(blobs.id, id))
    expect(Array.from(row?.data ?? [])).toEqual([0, 255, 128, 7])
  })
})
