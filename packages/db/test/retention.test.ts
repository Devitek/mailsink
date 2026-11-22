import { eq, inArray } from 'drizzle-orm'
import { beforeEach, expect, it } from 'vitest'
import type { Executor } from '../src/client'
import { newId } from '../src/ids'
import { enqueueJobs, FAILED_JOB_RUN_AT } from '../src/repositories/jobs'
import {
  deleteExpiredIdempotencyKeys,
  deleteOrphanBlobs,
  enforceMaxMessages,
  purgeExpiredLogs,
  purgeExpiredMessages,
  purgeFailedJobs,
} from '../src/repositories/retention'
import {
  apiLogs,
  attachments,
  blobs,
  idempotencyKeys,
  jobs,
  messages,
  smtpSessions,
  workspaces,
} from '../src/schema'
import {
  createTestConnection,
  createTestMessage,
  createTestWorkspace,
  describeDb,
} from '../src/testing'

const HOUR = 3600
const ago = (seconds: number) => new Date(Date.now() - seconds * 1000)

async function message(
  db: Executor,
  workspaceId: string,
  ageSeconds: number,
  connectionId?: string,
) {
  const row = await createTestMessage(db, workspaceId, { connectionId })
  await db
    .update(messages)
    .set({ createdAt: ago(ageSeconds) })
    .where(eq(messages.id, row.id))
  return row.id
}

async function blob(db: Executor, workspaceId: string) {
  const id = newId('blob')
  await db
    .insert(blobs)
    .values({ id, workspaceId, sha256: id, sizeBytes: 1, data: new Uint8Array([1]) })
  return id
}

describeDb('retention purges', (ctx) => {
  beforeEach(async () => {
    await ctx.db.delete(workspaces)
    await ctx.db.delete(jobs)
    await ctx.db.delete(apiLogs)
    await ctx.db.delete(smtpSessions)
  })

  const remaining = async (ids: string[]) =>
    (await ctx.db.select({ id: messages.id }).from(messages).where(inArray(messages.id, ids)))
      .map((r) => r.id)
      .sort()

  it('purges messages past the workspace retention or the connection override', async () => {
    const ws = await createTestWorkspace(ctx.db, { retentionSeconds: 2 * HOUR })
    const short = await createTestConnection(ctx.db, ws.id, { retentionSeconds: HOUR })
    const inherit = await createTestConnection(ctx.db, ws.id)
    const keep = [
      await message(ctx.db, ws.id, HOUR),
      await message(ctx.db, ws.id, 30 * 60, short.id),
      await message(ctx.db, ws.id, 90 * 60, inherit.id),
    ]
    const drop = [
      await message(ctx.db, ws.id, 3 * HOUR),
      await message(ctx.db, ws.id, 90 * 60, short.id),
    ]
    expect(await purgeExpiredMessages(ctx.db)).toBe(2)
    expect(await remaining([...keep, ...drop])).toEqual([...keep].sort())
    expect(await purgeExpiredMessages(ctx.db)).toBe(0)
  })

  it('keeps the max_messages newest messages per bounded workspace', async () => {
    const bounded = await createTestWorkspace(ctx.db, { maxMessages: 2 })
    const free = await createTestWorkspace(ctx.db)
    const oldest = await message(ctx.db, bounded.id, 300)
    const older = await message(ctx.db, bounded.id, 200)
    const newer = [await message(ctx.db, bounded.id, 100), await message(ctx.db, bounded.id, 50)]
    const unbounded = [await message(ctx.db, free.id, 300), await message(ctx.db, free.id, 200)]
    const unboundedThird = await message(ctx.db, free.id, 100)

    expect(await enforceMaxMessages(ctx.db)).toBe(2)
    const all = [oldest, older, ...newer, ...unbounded, unboundedThird]
    expect(await remaining(all)).toEqual([...newer, ...unbounded, unboundedThird].sort())
    expect(await enforceMaxMessages(ctx.db)).toBe(0)
  })

  it('deletes only blobs nothing references', async () => {
    const ws = await createTestWorkspace(ctx.db)
    const raw = await blob(ctx.db, ws.id)
    const attached = await blob(ctx.db, ws.id)
    const orphan = await blob(ctx.db, ws.id)
    const msg = await createTestMessage(ctx.db, ws.id, { rawBlobId: raw })
    await ctx.db.insert(attachments).values({
      id: newId('att'),
      messageId: msg.id,
      contentType: 'text/plain',
      disposition: 'attachment',
      sizeBytes: 1,
      blobId: attached,
    })
    expect(await deleteOrphanBlobs(ctx.db)).toBe(1)
    const left = await ctx.db.select({ id: blobs.id }).from(blobs)
    expect(left.map((b) => b.id).sort()).toEqual([raw, attached].sort())
    expect(left.some((b) => b.id === orphan)).toBe(false)

    await ctx.db.delete(messages).where(eq(messages.id, msg.id))
    expect(await deleteOrphanBlobs(ctx.db)).toBe(2)
  })

  it('deletes expired idempotency keys only', async () => {
    const ws = await createTestWorkspace(ctx.db)
    const key = (k: string, expiresAt: Date) => ({
      workspaceId: ws.id,
      key: k,
      requestHash: 'h',
      responseStatus: 200,
      responseBody: {},
      expiresAt,
    })
    await ctx.db
      .insert(idempotencyKeys)
      .values([key('old', ago(60)), key('fresh', new Date(Date.now() + 60_000))])
    expect(await deleteExpiredIdempotencyKeys(ctx.db)).toBe(1)
    const left = await ctx.db.select({ key: idempotencyKeys.key }).from(idempotencyKeys)
    expect(left).toEqual([{ key: 'fresh' }])
  })

  it('purges API logs and SMTP sessions with the same retention', async () => {
    const ws = await createTestWorkspace(ctx.db, { retentionSeconds: 2 * HOUR })
    const short = await createTestConnection(ctx.db, ws.id, { retentionSeconds: HOUR })
    const log = (
      id: string,
      ageSeconds: number,
      workspaceId: string | null,
      connectionId?: string,
    ) =>
      ctx.db.insert(apiLogs).values({
        id,
        workspaceId,
        connectionId,
        dialect: 'native',
        method: 'POST',
        path: '/v1/emails',
        statusCode: 200,
        durationMs: 1,
        createdAt: ago(ageSeconds),
      })
    await log('req_keep', HOUR, ws.id)
    await log('req_drop', 3 * HOUR, ws.id)
    await log('req_conn_drop', 90 * 60, ws.id, short.id)
    await log('req_anon_keep', 3 * HOUR, null)
    await log('req_anon_drop', 5 * HOUR, null)
    const session = (id: string, ageSeconds: number) =>
      ctx.db.insert(smtpSessions).values({
        id,
        workspaceId: ws.id,
        remoteAddress: '127.0.0.1',
        transcript: [],
        outcome: 'accepted',
        startedAt: ago(ageSeconds),
      })
    await session('smtp_keep', HOUR)
    await session('smtp_drop', 3 * HOUR)

    expect(await purgeExpiredLogs(ctx.db, 4 * HOUR)).toBe(4)
    const logs = await ctx.db.select({ id: apiLogs.id }).from(apiLogs)
    expect(logs.map((l) => l.id).sort()).toEqual(['req_anon_keep', 'req_keep'])
    const sessions = await ctx.db.select({ id: smtpSessions.id }).from(smtpSessions)
    expect(sessions).toEqual([{ id: 'smtp_keep' }])
    expect(await purgeExpiredLogs(ctx.db, 4 * HOUR)).toBe(0)
  })

  it('purges failed jobs once their grace period is over', async () => {
    const ws = await createTestWorkspace(ctx.db)
    const job = (failedAgo: number | null) => ({
      kind: 'simulate_delivery' as const,
      workspaceId: ws.id,
      payload: {},
      ...(failedAgo === null ? {} : { runAt: FAILED_JOB_RUN_AT, failedAt: ago(failedAgo) }),
    })
    const [pending, recent] = await enqueueJobs(ctx.db, [job(null), job(HOUR), job(3 * HOUR)])
    expect(await purgeFailedJobs(ctx.db, 2 * HOUR)).toBe(1)
    const left = await ctx.db.select({ id: jobs.id }).from(jobs)
    expect(left.map((j) => j.id).sort()).toEqual([pending?.id, recent?.id].sort())
    expect(await purgeFailedJobs(ctx.db, 2 * HOUR)).toBe(0)
  })
})
