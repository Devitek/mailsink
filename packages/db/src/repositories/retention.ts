import { type SQL, sql } from 'drizzle-orm'
import type { Executor } from '../client'

/**
 * Retention purges (#17). Every statement is an idempotent `DELETE … WHERE` that returns how
 * many rows it removed: running it twice, or from two processes, is harmless. Message
 * children (recipients, attachments, events) go with the message by cascade.
 */

async function countDeleted(db: Executor, deletion: SQL): Promise<number> {
  const result = await db.execute<{ n: number }>(
    sql`with d as (${deletion} returning 1) select count(*)::int as n from d`,
  )
  return Number(result.rows[0]?.n ?? 0)
}

const cutoff = (seconds: SQL) => sql`now() - make_interval(secs => ${seconds})`

/**
 * Rows older than their effective retention: their connection's `retention_seconds` when
 * set, else their workspace's. Rows without a workspace (failed authentication) use
 * `orphanSeconds` when given and are kept otherwise.
 *
 * Each case is a range scan per workspace or connection on the `(workspace_id, …time)`
 * indexes. The `lateral (… offset 0)` subqueries are on purpose: flattened, the planner
 * cannot estimate a cutoff that depends on the joined row and falls back to a full scan of
 * the table on every pass (measured on Postgres, docs/architecture/02-database-schema.md).
 */
async function purgeRetained(
  db: Executor,
  table: 'messages' | 'api_logs' | 'smtp_sessions',
  time: 'created_at' | 'started_at',
  orphanSeconds?: number,
): Promise<number> {
  const t = sql.raw(table)
  const at = sql.raw(time)
  const byConnection = await countDeleted(
    db,
    sql`delete from ${t} r using connections c cross join lateral (
        select x.id from ${t} x
        where x.workspace_id = c.workspace_id and x.connection_id = c.id
          and x.${at} < ${cutoff(sql`c.retention_seconds`)} offset 0
      ) expired
      where c.retention_seconds is not null and r.id = expired.id`,
  )
  const byWorkspace = await countDeleted(
    db,
    sql`delete from ${t} r using workspaces w cross join lateral (
        select x.id, x.connection_id from ${t} x
        where x.workspace_id = w.id and x.${at} < ${cutoff(sql`w.retention_seconds`)} offset 0
      ) expired
      where r.id = expired.id and not exists (select 1 from connections c
        where c.id = expired.connection_id and c.workspace_id = w.id
          and c.retention_seconds is not null)`,
  )
  const orphans =
    orphanSeconds === undefined
      ? 0
      : await countDeleted(
          db,
          sql`delete from ${t} r
            where r.workspace_id is null and r.${at} < ${cutoff(sql`${orphanSeconds}::int`)}`,
        )
  return byConnection + byWorkspace + orphans
}

/** Messages older than their effective retention. */
export function purgeExpiredMessages(db: Executor): Promise<number> {
  return purgeRetained(db, 'messages', 'created_at')
}

/** Keeps the `max_messages` newest messages of each bounded workspace, oldest go first. */
export function enforceMaxMessages(db: Executor): Promise<number> {
  return countDeleted(
    db,
    sql`delete from messages m using workspaces w cross join lateral (
        select x.id from messages x where x.workspace_id = w.id
        order by x.created_at desc, x.id desc offset w.max_messages
      ) excess
      where w.max_messages is not null and m.id = excess.id`,
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
  const api = await purgeRetained(db, 'api_logs', 'created_at', orphanRetentionSeconds)
  const smtp = await purgeRetained(db, 'smtp_sessions', 'started_at', orphanRetentionSeconds)
  return api + smtp
}

/** Jobs given up on (`failJob`) more than `graceSeconds` ago. */
export function purgeFailedJobs(db: Executor, graceSeconds: number): Promise<number> {
  return countDeleted(
    db,
    sql`delete from jobs where failed_at < ${cutoff(sql`${graceSeconds}::int`)}`,
  )
}
