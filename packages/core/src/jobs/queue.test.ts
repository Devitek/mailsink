import { enqueueJobs, FAILED_JOB_RUN_AT, jobs } from '@mailsink/db'
import { createTestWorkspace, describeDb } from '@mailsink/db/testing'
import { eq, sql } from 'drizzle-orm'
import { beforeEach, expect, it, vi } from 'vitest'
import { createJobRunner, type JobHandler, PermanentJobError } from './queue'

const quiet = { warn: () => {}, error: () => {} }

describeDb('job runner', (ctx) => {
  let workspaceId = ''

  beforeEach(async () => {
    await ctx.db.delete(jobs)
    workspaceId = (await createTestWorkspace(ctx.db)).id
  })

  const enqueue = async (
    n = 1,
    kind: 'simulate_delivery' | 'deliver_webhook' = 'simulate_delivery',
  ) =>
    enqueueJobs(
      ctx.db,
      Array.from({ length: n }, (_, i) => ({ kind, workspaceId, payload: { i } })),
    )
  const all = () => ctx.db.select().from(jobs).orderBy(jobs.id)
  const runner = (handler: JobHandler, maxAttempts = 3) =>
    createJobRunner({
      db: ctx.db,
      handlers: { simulate_delivery: handler },
      maxAttempts,
      log: quiet,
    })
  const makeDue = () => ctx.db.update(jobs).set({ runAt: sql`now()` })

  it('runs due jobs and deletes them', async () => {
    await enqueue(3)
    const handler = vi.fn(async () => {})
    expect(await runner(handler)()).toBe(3)
    expect(handler).toHaveBeenCalledTimes(3)
    expect(await all()).toEqual([])
  })

  it('leaves kinds without a handler alone', async () => {
    await enqueue(1, 'deliver_webhook')
    expect(await runner(async () => {})()).toBe(0)
    expect(await all()).toMatchObject([{ kind: 'deliver_webhook', attempts: 0, lockedUntil: null }])
  })

  it('retries with backoff and last_error, then gives up after maxAttempts', async () => {
    await enqueue(1)
    const run = runner(async () => {
      throw new Error('smtp down')
    })
    await run()
    const [first] = await all()
    expect(first).toMatchObject({ attempts: 1, lastError: 'smtp down', lockedUntil: null })
    expect(first?.runAt.getTime()).toBeGreaterThan(Date.now() + 3_000)

    await makeDue()
    await run()
    await makeDue()
    await run()
    const [last] = await all()
    expect(last).toMatchObject({ attempts: 3, lastError: 'smtp down' })
    expect(last?.runAt).toEqual(FAILED_JOB_RUN_AT)
    expect(await run()).toBe(0)
  })

  it('fails a job at once on a permanent error', async () => {
    await enqueue(1)
    await runner(async () => {
      throw new PermanentJobError('bad payload')
    })()
    expect(await all()).toMatchObject([{ attempts: 1, runAt: FAILED_JOB_RUN_AT }])
  })

  it('abandons a job whose lease kept expiring', async () => {
    const [job] = await enqueue(1)
    await ctx.db
      .update(jobs)
      .set({ attempts: 3 })
      .where(eq(jobs.id, job?.id ?? 0))
    const handler = vi.fn(async () => {})
    await runner(handler)()
    expect(handler).not.toHaveBeenCalled()
    expect(await all()).toMatchObject([{ runAt: FAILED_JOB_RUN_AT }])
  })

  it('stops at the next job when aborted and hands the rest back', async () => {
    await enqueue(3)
    const stop = new AbortController()
    const handler = vi.fn(async () => stop.abort())
    expect(await runner(handler)(stop.signal)).toBe(1)
    const left = await all()
    expect(left).toHaveLength(2)
    expect(left.every((j) => j.attempts === 0 && j.lockedUntil === null)).toBe(true)
  })
})
