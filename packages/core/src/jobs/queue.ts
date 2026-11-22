import {
  claimJobs,
  completeJob,
  type Database,
  failJob,
  type Job,
  type JobKind,
  releaseJobs,
  retryJob,
} from '@mailsink/db'
import { type BackoffOptions, backoffSeconds } from './backoff'

export interface JobContext {
  db: Database
  signal: AbortSignal
}

/**
 * Handles one job. Delivery is at least once (a crash after the handler but before the
 * job row is deleted replays it), so every handler must be idempotent.
 */
export type JobHandler = (job: Job, ctx: JobContext) => Promise<void>
export type JobHandlers = Partial<Record<JobKind, JobHandler>>

/** Thrown by a handler when retrying cannot help (malformed payload): fails at once. */
export class PermanentJobError extends Error {
  override name = 'PermanentJobError'
}

export interface JobRunnerOptions {
  db: Database
  /** Only kinds with a handler are claimed; the others wait for theirs. */
  handlers: JobHandlers
  batchSize?: number
  lockSeconds?: number
  /** Attempts before a job is given up on (default 5). */
  maxAttempts?: number
  backoff?: BackoffOptions
  log?: Pick<Console, 'warn' | 'error'>
}

/** Claims a batch of due jobs (D5) and runs them one by one; resolves with the count run. */
export type JobRunner = (signal?: AbortSignal) => Promise<number>

export function createJobRunner(options: JobRunnerOptions): JobRunner {
  const { db, handlers, batchSize = 20, lockSeconds = 30, maxAttempts = 5 } = options
  const log = options.log ?? console
  const kinds = Object.keys(handlers) as JobKind[]

  async function run(job: Job, signal: AbortSignal): Promise<void> {
    const handler = handlers[job.kind]
    if (!handler) return releaseJobs(db, [job.id])
    if (job.attempts > maxAttempts) {
      // Its lease expired too often: the process died while running it.
      log.error(`[mailsink] job ${job.id} (${job.kind}) abandoned after ${maxAttempts} attempts`)
      return failJob(db, job.id, `lease expired after ${maxAttempts} attempts`)
    }
    try {
      await handler(job, { db, signal })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (error instanceof PermanentJobError || job.attempts >= maxAttempts) {
        log.error(`[mailsink] job ${job.id} (${job.kind}) failed: ${message}`)
        return failJob(db, job.id, message)
      }
      const delaySeconds = backoffSeconds(job.attempts, options.backoff)
      log.warn(`[mailsink] job ${job.id} (${job.kind}) retried in ${delaySeconds} s: ${message}`)
      return retryJob(db, job.id, { error: message, delaySeconds })
    }
    await completeJob(db, job.id)
  }

  return async (signal = new AbortController().signal) => {
    if (signal.aborted) return 0
    const claimed = await claimJobs(db, { limit: batchSize, lockSeconds, kinds })
    let done = 0
    for (const job of claimed) {
      if (signal.aborted) {
        // Clean stop: hand back what was claimed but not started.
        await releaseJobs(
          db,
          claimed.slice(done).map((j) => j.id),
        )
        break
      }
      await run(job, signal)
      done += 1
    }
    return done
  }
}
