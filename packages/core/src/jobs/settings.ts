/** Tunables of the job queue (D5), exposed as `MAILSINK_JOBS_*` by the runtime config. */
export interface JobSettings {
  /** Polling period of the worker. */
  pollIntervalMs: number
  /** Jobs claimed per poll. */
  batchSize: number
  /** Lease of a claimed job: unfinished after it, the job is claimable again. */
  lockSeconds: number
  /** Attempts before a job is given up on. */
  maxAttempts: number
  /** Retry delay after the first failed attempt, doubled on each further one. */
  backoffBaseSeconds: number
  /** Upper bound of the retry delay. */
  backoffMaxSeconds: number
  /** How long a job given up on stays in the table for diagnosis before retention purges it. */
  failedRetentionSeconds: number
}

export const DEFAULT_JOB_SETTINGS: JobSettings = {
  pollIntervalMs: 1000,
  batchSize: 20,
  lockSeconds: 30,
  maxAttempts: 5,
  backoffBaseSeconds: 5,
  backoffMaxSeconds: 900,
  failedRetentionSeconds: 7 * 86_400,
}
