import { and, asc, inArray, isNull, lt, lte, or, sql } from 'drizzle-orm'
import type { Executor } from '../client'
import { jobs } from '../schema/jobs'

export type Job = typeof jobs.$inferSelect
export type NewJob = typeof jobs.$inferInsert

export interface ClaimOptions {
  /** Max jobs returned (default 20). */
  limit?: number
  /** Lease duration: an unfinished job becomes claimable again after it (default 30 s). */
  lockSeconds?: number
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
  const { limit = 20, lockSeconds = 30 } = options
  const due = db
    .select({ id: jobs.id })
    .from(jobs)
    .where(
      and(
        lte(jobs.runAt, sql`now()`),
        or(isNull(jobs.lockedUntil), lt(jobs.lockedUntil, sql`now()`)),
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
