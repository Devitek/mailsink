import { blobs, messages, newId, workspaces } from '@mailsink/db'
import { createTestWorkspace, describeDb } from '@mailsink/db/testing'
import { eq } from 'drizzle-orm'
import { beforeEach, expect, it } from 'vitest'
import { insertQueuedMessage } from '../simulation/testing/fixtures'
import { type RetentionReport, runRetention } from './run'
import { startRetentionScheduler } from './scheduler'

const quiet = { info: () => {}, error: () => {} }

describeDb('retention pass', (ctx) => {
  let workspaceId = ''

  beforeEach(async () => {
    await ctx.db.delete(workspaces)
    workspaceId = (await createTestWorkspace(ctx.db)).id
  })

  /** An expired message whose raw EML blob only it references. */
  async function expiredMessageWithBlob() {
    const blobId = newId('blob')
    await ctx.db
      .insert(blobs)
      .values({ id: blobId, workspaceId, sha256: blobId, sizeBytes: 1, data: new Uint8Array([1]) })
    const id = await insertQueuedMessage(ctx.db, workspaceId, [{ email: 'a@example.com' }], {
      job: false,
    })
    await ctx.db
      .update(messages)
      .set({ rawBlobId: blobId, createdAt: new Date(Date.now() - 8 * 86_400_000) })
      .where(eq(messages.id, id))
    return { id, blobId }
  }

  it('purges expired messages and their now orphan blobs in one pass', async () => {
    await expiredMessageWithBlob()
    const fresh = await insertQueuedMessage(ctx.db, workspaceId, [{ email: 'b@example.com' }], {
      job: false,
    })
    expect(await runRetention(ctx.db)).toEqual({
      expiredMessages: 1,
      overQuotaMessages: 0,
      orphanBlobs: 1,
      idempotencyKeys: 0,
      logs: 0,
    })
    expect(await ctx.db.select({ id: messages.id }).from(messages)).toEqual([{ id: fresh }])
    expect(await ctx.db.select().from(blobs)).toEqual([])
    expect(Object.values(await runRetention(ctx.db)).every((n) => n === 0)).toBe(true)
  })

  it('runs periodically until stopped', async () => {
    await expiredMessageWithBlob()
    const passes: RetentionReport[] = []
    const scheduler = startRetentionScheduler({
      db: ctx.db,
      intervalMs: 20,
      log: quiet,
      onPass: (report) => passes.push(report),
    })
    await expect.poll(() => passes.length, { timeout: 5_000 }).toBeGreaterThanOrEqual(2)
    await scheduler.stop()
    const count = passes.length
    expect(passes[0]?.expiredMessages).toBe(1)
    expect(passes[1]?.expiredMessages).toBe(0)
    await new Promise((resolve) => setTimeout(resolve, 60))
    expect(passes.length).toBe(count)
  })
})
