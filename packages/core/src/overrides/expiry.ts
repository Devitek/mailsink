import { closeExpiredOverrides, type Database, type Override } from '@mailsink/db'
import { startWorker, type Worker } from '../jobs/worker'

/** Proposition D74: overrides past their TTL are closed within 5 s. */
export const OVERRIDE_EXPIRY_INTERVAL_MS = 5_000

/**
 * Closes the overrides whose TTL is over (`reset_at = expires_at`). Reads already ignore
 * them, so this pass only keeps the history exact and frees the scope.
 */
export function expireOverrides(db: Database, now: Date = new Date()): Promise<Override[]> {
  return closeExpiredOverrides(db, now)
}

export interface OverrideExpirySchedulerOptions {
  db: Database
  intervalMs?: number
  log?: Pick<Console, 'info' | 'error'>
  /**
   * Called with the overrides closed by a pass, awaited (the runtime publishes
   * `override.changed`, D96); a failure is logged like a failed pass.
   */
  onExpired?: (closed: Override[]) => void | Promise<void>
}

export function startOverrideExpiryScheduler(options: OverrideExpirySchedulerOptions): Worker {
  const log = options.log ?? console
  return startWorker({
    intervalMs: options.intervalMs ?? OVERRIDE_EXPIRY_INTERVAL_MS,
    tick: async () => {
      const closed = await expireOverrides(options.db)
      if (closed.length === 0) return
      log.info(`[mailsink] overrides: ${closed.length} expired override(s) reset`)
      await options.onExpired?.(closed)
    },
    onError: (error) => log.error('[mailsink] override expiry pass failed', error),
  })
}
