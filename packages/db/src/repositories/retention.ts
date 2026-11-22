import { type SQL, sql } from 'drizzle-orm'
import type { Executor } from '../client'

/**
 * Retention purges (#17). Every function is one idempotent `DELETE … WHERE` statement that
 * returns how many rows it removed: running it twice, or from two processes, is harmless.
 * Message children (recipients, attachments, events) go with the message by cascade.
 */

async function countDeleted(db: Executor, deletion: SQL): Promise<number> {
  const result = await db.execute<{ n: number }>(
    sql`with d as (${deletion} returning 1) select count(*)::int as n from d`,
  )
  return Number(result.rows[0]?.n ?? 0)
}

/**
 * Effective retention of a row: its connection's `retention_seconds` when set, else its
 * workspace's. Rows without a workspace (failed authentication) use `fallbackSeconds`.
 */
const retention = (workspace: SQL, connection: SQL, fallbackSeconds = 0) =>
  sql`make_interval(secs => coalesce(
    (select c.retention_seconds from connections c where c.id = ${connection}),
    (select w.retention_seconds from workspaces w where w.id = ${workspace}),
    ${fallbackSeconds}::int))`

/** Messages older than their effective retention. */
export function purgeExpiredMessages(db: Executor): Promise<number> {
  return countDeleted(
    db,
    sql`delete from messages m
      where m.created_at < now() - ${retention(sql`m.workspace_id`, sql`m.connection_id`)}`,
  )
}

/** Keeps the `max_messages` newest messages of each bounded workspace, oldest go first. */
export function enforceMaxMessages(db: Executor): Promise<number> {
  return countDeleted(
    db,
    sql`delete from messages m using (
        select r.id from (
          select m2.id, w.max_messages,
            row_number() over (partition by m2.workspace_id
              order by m2.created_at desc, m2.id desc) as rank
          from messages m2 join workspaces w on w.id = m2.workspace_id
          where w.max_messages is not null
        ) r where r.rank > r.max_messages
      ) excess
      where m.id = excess.id`,
  )
}

/** Blobs no message (raw EML) nor attachment references any more. */
export function deleteOrphanBlobs(db: Executor): Promise<number> {
  return countDeleted(
    db,
    sql`delete from blobs b
      where not exists (select 1 from messages m where m.raw_blob_id = b.id)
        and not exists (select 1 from attachments a where a.blob_id = b.id)`,
  )
}

export function deleteExpiredIdempotencyKeys(db: Executor): Promise<number> {
  return countDeleted(db, sql`delete from idempotency_keys where expires_at < now()`)
}

/**
 * API logs and SMTP sessions, with the same effective retention as messages. Rows without
 * a workspace (failed authentication) are kept `orphanRetentionSeconds`.
 */
export async function purgeExpiredLogs(
  db: Executor,
  orphanRetentionSeconds: number,
): Promise<number> {
  const api = await countDeleted(
    db,
    sql`delete from api_logs l
      where l.created_at < now() - ${retention(sql`l.workspace_id`, sql`l.connection_id`, orphanRetentionSeconds)}`,
  )
  const smtp = await countDeleted(
    db,
    sql`delete from smtp_sessions s
      where s.started_at < now() - ${retention(sql`s.workspace_id`, sql`s.connection_id`, orphanRetentionSeconds)}`,
  )
  return api + smtp
}
