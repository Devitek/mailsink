import { eq, sql } from 'drizzle-orm'
import { beforeEach, expect, it } from 'vitest'
import { claimJobs, enqueueJobs } from '../src/repositories/jobs'
import { jobs } from '../src/schema'
import { createTestWorkspace, describeDb } from '../src/testing'

const ids = (rows: { id: number }[]) => rows.map((r) => r.id).sort((a, b) => a - b)

describeDb('jobs queue', (ctx) => {
  let workspaceId = ''

  beforeEach(async () => {
    await ctx.db.delete(jobs)
    workspaceId = (await createTestWorkspace(ctx.db)).id
  })

  const enqueue = (n: number, runAt?: Date) =>
    enqueueJobs(
      ctx.db,
      Array.from({ length: n }, (_, i) => ({
        kind: 'simulate_delivery' as const,
        workspaceId,
        payload: { i },
        runAt,
      })),
    )

  it('claims due jobs in run_at order, leases them and counts attempts', async () => {
    await enqueue(3)
    await enqueue(1, new Date(Date.now() + 60_000))
    const claimed = await claimJobs(ctx.db, { limit: 10 })
    expect(claimed).toHaveLength(3)
    expect(claimed.every((j) => j.attempts === 1 && j.lockedUntil !== null)).toBe(true)
    expect(await claimJobs(ctx.db)).toEqual([])
  })

  it('makes a job claimable again once its lease expires', async () => {
    const [job] = await enqueue(1)
    await claimJobs(ctx.db, { lockSeconds: 30 })
    await ctx.db
      .update(jobs)
      .set({ lockedUntil: sql`now() - interval '1 second'` })
      .where(eq(jobs.id, job?.id ?? 0))
    const [again] = await claimJobs(ctx.db)
    expect(again?.id).toBe(job?.id)
    expect(again?.attempts).toBe(2)
  })

  it('never hands the same job to two concurrent claimers', async () => {
    await enqueue(30)
    const batches = await Promise.all(
      Array.from({ length: 4 }, () => claimJobs(ctx.db, { limit: 10 })),
    )
    const all = batches.flatMap(ids)
    expect(new Set(all).size).toBe(all.length)
    expect(all).toHaveLength(30)
  })

  // Deterministic overlap: the second claim runs while the first transaction still holds
  // its row locks. Postgres only: PGlite has one connection, so a claim outside the open
  // transaction would wait for it instead of skipping.
  it.runIf(ctx.driver === 'postgres')(
    'skips rows locked by an uncommitted claim (SKIP LOCKED)',
    async () => {
      await enqueue(6)
      await ctx.db.transaction(async (tx) => {
        const first = await claimJobs(tx, { limit: 4 })
        const second = await claimJobs(ctx.db, { limit: 4 })
        expect(first).toHaveLength(4)
        expect(second).toHaveLength(2)
        expect(ids(first).filter((id) => ids(second).includes(id))).toEqual([])
      })
    },
  )
})
