import { countFailedJobs, type Database } from '@mailsink/db'
import { startWorker, type Worker } from '../jobs/worker'
import { type RetentionOptions, type RetentionReport, retentionTotal, runRetention } from './run'

export interface RetentionSchedulerOptions extends RetentionOptions {
  db: Database
  intervalMs: number
  log?: Pick<Console, 'info' | 'warn' | 'error'>
  /** Called after each pass (tests, metrics). */
  onPass?: (report: RetentionReport) => void
}

/**
 * Runs a retention pass every `intervalMs`, never two at once (the polling loop skips a
 * tick while one is in flight). `stop()` waits for the pass in flight.
 *
 * Each pass also counts the jobs given up on and still kept for diagnosis, and warns when
 * that count changes (not on every pass, the log would drown in repeats).
 */
export function startRetentionScheduler(options: RetentionSchedulerOptions): Worker {
  const log = options.log ?? console
  let failedJobs = 0
  return startWorker({
    intervalMs: options.intervalMs,
    tick: async () => {
      const report = await runRetention(options.db, options)
      if (retentionTotal(report) > 0) log.info(`[mailsink] retention: ${JSON.stringify(report)}`)
      const failed = await countFailedJobs(options.db)
      if (failed !== failedJobs && failed > 0) {
        log.warn(
          `[mailsink] jobs: ${failed} failed job(s) kept for diagnosis (table jobs, column last_error)`,
        )
      }
      failedJobs = failed
      options.onPass?.(report)
    },
    onError: (error) => log.error('[mailsink] retention pass failed', error),
  })
}
