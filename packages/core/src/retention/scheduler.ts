import type { Database } from '@mailsink/db'
import { startWorker, type Worker } from '../jobs/worker'
import { type RetentionReport, retentionTotal, runRetention } from './run'

export interface RetentionSchedulerOptions {
  db: Database
  intervalMs: number
  log?: Pick<Console, 'info' | 'error'>
  /** Called after each pass (tests, metrics). */
  onPass?: (report: RetentionReport) => void
}

/**
 * Runs a retention pass every `intervalMs`, never two at once (the polling loop skips a
 * tick while one is in flight). `stop()` waits for the pass in flight.
 */
export function startRetentionScheduler(options: RetentionSchedulerOptions): Worker {
  const log = options.log ?? console
  return startWorker({
    intervalMs: options.intervalMs,
    tick: async () => {
      const report = await runRetention(options.db)
      if (retentionTotal(report) > 0) log.info(`[mailsink] retention: ${JSON.stringify(report)}`)
      options.onPass?.(report)
    },
    onError: (error) => log.error('[mailsink] retention pass failed', error),
  })
}
