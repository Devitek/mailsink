import { DEFAULT_RETENTION_SECONDS } from '@mailsink/contracts'
import {
  type Database,
  deleteExpiredIdempotencyKeys,
  deleteOrphanBlobs,
  enforceMaxMessages,
  purgeExpiredLogs,
  purgeExpiredMessages,
} from '@mailsink/db'

export interface RetentionReport {
  expiredMessages: number
  overQuotaMessages: number
  orphanBlobs: number
  idempotencyKeys: number
  logs: number
}

/**
 * One retention pass (#17). Each step is an idempotent `DELETE … WHERE`, so passes may
 * overlap or repeat (two processes, a pass interrupted halfway) without harm. Blobs go last
 * so the messages purged by this very pass release theirs.
 */
export async function runRetention(db: Database): Promise<RetentionReport> {
  const expiredMessages = await purgeExpiredMessages(db)
  const overQuotaMessages = await enforceMaxMessages(db)
  const orphanBlobs = await deleteOrphanBlobs(db)
  const idempotencyKeys = await deleteExpiredIdempotencyKeys(db)
  // Logs without a workspace (failed authentication) keep the default retention.
  const logs = await purgeExpiredLogs(db, DEFAULT_RETENTION_SECONDS)
  return { expiredMessages, overQuotaMessages, orphanBlobs, idempotencyKeys, logs }
}

export const retentionTotal = (report: RetentionReport): number =>
  Object.values(report).reduce((sum, n) => sum + n, 0)
