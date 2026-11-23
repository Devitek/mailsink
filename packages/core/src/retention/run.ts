import { DEFAULT_RETENTION_SECONDS } from '@mailsink/contracts'
import {
  type Database,
  deleteExpiredIdempotencyKeys,
  deleteOrphanBlobs,
  enforceMaxMessages,
  purgeExpiredLogs,
  purgeExpiredMessages,
  purgeExpiredWebhookDeliveries,
  purgeFailedJobs,
} from '@mailsink/db'
import { DEFAULT_JOB_SETTINGS } from '../jobs/settings'

export interface RetentionReport {
  expiredMessages: number
  overQuotaMessages: number
  orphanBlobs: number
  idempotencyKeys: number
  logs: number
  /** Finished webhook deliveries (and their attempts) past their retention. */
  webhookDeliveries: number
  /** Jobs given up on whose diagnosis period is over. */
  failedJobs: number
}

export interface RetentionOptions {
  /** How long a failed job is kept (default DEFAULT_JOB_SETTINGS.failedRetentionSeconds). */
  failedJobRetentionSeconds?: number
}

/**
 * One retention pass (#17). Each step is an idempotent `DELETE … WHERE`, so passes may
 * overlap or repeat (two processes, a pass interrupted halfway) without harm. Blobs go last
 * so the messages purged by this very pass release theirs.
 */
export async function runRetention(
  db: Database,
  options: RetentionOptions = {},
): Promise<RetentionReport> {
  const expiredMessages = await purgeExpiredMessages(db)
  const overQuotaMessages = await enforceMaxMessages(db)
  const orphanBlobs = await deleteOrphanBlobs(db)
  const idempotencyKeys = await deleteExpiredIdempotencyKeys(db)
  // Logs without a workspace (failed authentication) keep the default retention.
  const logs = await purgeExpiredLogs(db, DEFAULT_RETENTION_SECONDS)
  const webhookDeliveries = await purgeExpiredWebhookDeliveries(db)
  const failedJobs = await purgeFailedJobs(
    db,
    options.failedJobRetentionSeconds ?? DEFAULT_JOB_SETTINGS.failedRetentionSeconds,
  )
  return {
    expiredMessages,
    overQuotaMessages,
    orphanBlobs,
    idempotencyKeys,
    logs,
    webhookDeliveries,
    failedJobs,
  }
}

export const retentionTotal = (report: RetentionReport): number =>
  Object.values(report).reduce((sum, n) => sum + n, 0)
