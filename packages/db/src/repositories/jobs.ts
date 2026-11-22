import { and, asc, eq, inArray, isNull, lt, lte, or, sql } from 'drizzle-orm'
import type { Executor } from '../client'
import { type JobKind, jobs } from '../schema/jobs'

export type Job = typeof jobs.$inferSelect
export type NewJob = typeof jobs.$inferInsert

export interface ClaimOptions {
  /** Max jobs returned (default 20). */
  limit?: number
  /** Lease duration: an unfinished job becomes claimable again after it (default 30 s). */
  lockSeconds?: number
  /** Only these kinds (default: every kind). Kinds without a handler stay untouched. */
  kinds?: readonly JobKind[]
}

/** `run_at` of a job given up on. */
export const FAILED_JOB_RUN_AT = new Date('9999-12-31T00:00:00Z')

export interface RetryOptions {
  error: string
  /** Delay before the job is due again. */
  delaySeconds: number
}

export async function enqueueJobs(db: Executor, rows: NewJob[]): Promise<Job[]> {
  if (rows.length === 0) return []
  return db.insert(jobs).values(rows).returning()
}

/**
 * Leases due jobs (D5). `FOR UPDATE SKIP LOCKED` lets concurrent claimers on Postgres
 * pass over rows another transaction is claiming, so two claims never return the same job.
 * PGlite has a single connection: claims are serialized and SKIP LOCKED never has to skip.
 */
export async function claimJobs(db: Executor, options: ClaimOptions = {}): Promise<Job[]> {
  const { limit = 20, lockSeconds = 30, kinds } = options
  if (kinds?.length === 0) return []
  const due = db
    .select({ id: jobs.id })
    .from(jobs)
    .where(
      and(
        lte(jobs.runAt, sql`now()`),
        or(isNull(jobs.lockedUntil), lt(jobs.lockedUntil, sql`now()`)),
        kinds ? inArray(jobs.kind, [...kinds]) : undefined,
      ),
    )
    .orderBy(asc(jobs.runAt))
    .limit(limit)
    .for('update', { skipLocked: true })
  return db
    .update(jobs)
    .set({
      lockedUntil: sql`now() + make_interval(secs => ${lockSeconds})`,
      attempts: sql`${jobs.attempts} + 1`,
    })
    .where(inArray(jobs.id, due))
    .returning()
}

/** A job done for good is deleted: the table only holds pending, leased or failed work. */
export async function completeJob(db: Executor, id: number): Promise<void> {
  await db.delete(jobs).where(eq(jobs.id, id))
}

/** Records the error and makes the job due again after the delay (lease dropped). */
export async function retryJob(db: Executor, id: number, options: RetryOptions): Promise<void> {
  await db
    .update(jobs)
    .set({
      lastError: options.error,
      lockedUntil: null,
      runAt: sql`now() + make_interval(secs => ${options.delaySeconds})`,
    })
    .where(eq(jobs.id, id))
}

/**
 * Gives up on a job: it stays in the table with its `last_error` for diagnosis, but its
 * `run_at` is pushed to the far future (`FAILED_JOB_RUN_AT`, a valid Date unlike `infinity`)
 * so no claim ever returns it again.
 */
export async function failJob(db: Executor, id: number, error: string): Promise<void> {
  await db
    .update(jobs)
    .set({ lastError: error, lockedUntil: null, runAt: FAILED_JOB_RUN_AT })
    .where(eq(jobs.id, id))
}

/** Hands claimed but unstarted jobs back (clean stop): lease dropped, attempt not counted. */
export async function releaseJobs(db: Executor, ids: readonly number[]): Promise<void> {
  if (ids.length === 0) return
  await db
    .update(jobs)
    .set({ lockedUntil: null, attempts: sql`greatest(${jobs.attempts} - 1, 0)` })
    .where(inArray(jobs.id, [...ids]))
}
