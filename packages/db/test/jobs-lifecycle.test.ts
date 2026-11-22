import { eq } from 'drizzle-orm'
import { beforeEach, expect, it } from 'vitest'
import {
  claimJobs,
  completeJob,
  enqueueJobs,
  failJob,
  releaseJobs,
  retryJob,
} from '../src/repositories/jobs'
import { jobs } from '../src/schema'
import { describeDb } from '../src/testing'
import { insertWorkspace } from './fixtures'

describeDb('jobs lifecycle', (ctx) => {
  let workspaceId = ''

  beforeEach(async () => {
    await ctx.db.delete(jobs)
    workspaceId = (await insertWorkspace(ctx.db)).id
  })

  const one = async (kind: 'simulate_delivery' | 'deliver_webhook' = 'simulate_delivery') => {
    const [job] = await enqueueJobs(ctx.db, [{ kind, workspaceId, payload: {} }])
    if (!job) throw new Error('job not enqueued')
    return job
  }
  const row = async (id: number) => (await ctx.db.select().from(jobs).where(eq(jobs.id, id)))[0]

  it('claims only the requested kinds', async () => {
    await one('deliver_webhook')
    const sim = await one('simulate_delivery')
    const claimed = await claimJobs(ctx.db, { kinds: ['simulate_delivery'] })
    expect(claimed.map((j) => j.id)).toEqual([sim.id])
    expect(await claimJobs(ctx.db, { kinds: [] })).toEqual([])
  })

  it('deletes a completed job', async () => {
    const job = await one()
    await completeJob(ctx.db, job.id)
    expect(await row(job.id)).toBeUndefined()
  })

  it('retries later with the error recorded and the lease dropped', async () => {
    const job = await one()
    await claimJobs(ctx.db)
    await retryJob(ctx.db, job.id, { error: 'boom', delaySeconds: 60 })
    const after = await row(job.id)
    expect(after).toMatchObject({ lastError: 'boom', lockedUntil: null, attempts: 1 })
    expect(after?.runAt.getTime()).toBeGreaterThan(Date.now() + 50_000)
    expect(await claimJobs(ctx.db)).toEqual([])

    await retryJob(ctx.db, job.id, { error: 'again', delaySeconds: 0 })
    expect((await claimJobs(ctx.db)).map((j) => j.attempts)).toEqual([2])
  })

  it('parks a failed job forever with its last error', async () => {
    const job = await one()
    await claimJobs(ctx.db)
    await failJob(ctx.db, job.id, 'gave up')
    expect(await row(job.id)).toMatchObject({ lastError: 'gave up', lockedUntil: null })
    expect(await claimJobs(ctx.db)).toEqual([])
  })

  it('releases claimed jobs without counting the attempt', async () => {
    const job = await one()
    await claimJobs(ctx.db)
    await releaseJobs(ctx.db, [job.id])
    const [again] = await claimJobs(ctx.db)
    expect(again).toMatchObject({ id: job.id, attempts: 1 })
  })
})
