import { and, eq, lt, sql } from 'drizzle-orm'
import type { Executor } from '../client'
import { workspaces } from '../schema/workspaces'

/**
 * Records activity at `at` (D16): `last_activity_at = at` and, for an ephemeral workspace,
 * `expires_at = at + idle_ttl_seconds`; persistent workspaces keep `expires_at` null. An
 * older `at` never moves the columns back (a late flush after a newer write). Resolves
 * false when nothing was written (workspace gone, or already touched at `at` or later).
 */
export async function touchWorkspaceActivity(
  db: Executor,
  workspaceId: string,
  at: Date,
): Promise<boolean> {
  const rows = await db
    .update(workspaces)
    .set({
      lastActivityAt: at,
      expiresAt: sql`case when ${workspaces.ephemeral}
        then ${at.toISOString()}::timestamptz + make_interval(secs => ${workspaces.idleTtlSeconds})
        end`,
    })
    .where(and(eq(workspaces.id, workspaceId), lt(workspaces.lastActivityAt, at)))
    .returning({ id: workspaces.id })
  return rows.length > 0
}

/**
 * Ephemeral GC (every 30 s): deletes the ephemeral workspaces whose `expires_at` is past
 * (`workspaces_expiry_idx` range scan); everything they own cascades. Returns their ids.
 */
export async function deleteExpiredWorkspaces(db: Executor, now: Date): Promise<string[]> {
  const rows = await db
    .delete(workspaces)
    .where(and(sql`${workspaces.ephemeral}`, lt(workspaces.expiresAt, now)))
    .returning({ id: workspaces.id })
  return rows.map((r) => r.id)
}
