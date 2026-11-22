import { and, eq, gt, lte } from 'drizzle-orm'
import type { Executor } from '../client'
import { idempotencyKeys } from '../schema/idempotency'

export type IdempotencyRecord = typeof idempotencyKeys.$inferSelect

/** Live (not expired) record of an `Idempotency-Key` in a workspace. */
export async function findIdempotencyRecord(
  db: Executor,
  workspaceId: string,
  key: string,
  now: Date = new Date(),
): Promise<IdempotencyRecord | undefined> {
  const [row] = await db
    .select()
    .from(idempotencyKeys)
    .where(
      and(
        eq(idempotencyKeys.workspaceId, workspaceId),
        eq(idempotencyKeys.key, key),
        gt(idempotencyKeys.expiresAt, now),
      ),
    )
    .limit(1)
  return row
}

/**
 * Stores the response of a key. An expired record of the same key is replaced; a live one
 * makes the insert fail with a unique violation (a concurrent request won the key).
 */
export async function insertIdempotencyRecord(
  db: Executor,
  record: IdempotencyRecord,
  now: Date = new Date(),
): Promise<void> {
  await db
    .delete(idempotencyKeys)
    .where(
      and(
        eq(idempotencyKeys.workspaceId, record.workspaceId),
        eq(idempotencyKeys.key, record.key),
        lte(idempotencyKeys.expiresAt, now),
      ),
    )
  await db.insert(idempotencyKeys).values(record)
}
