import { and, asc, eq, gt, isNotNull, isNull, lte, or, sql } from 'drizzle-orm'
import type { Executor } from '../client'
import { connections } from '../schema/connections'
import { overrides } from '../schema/overrides'
import { workspaces } from '../schema/workspaces'

export type Override = typeof overrides.$inferSelect
export type NewOverride = typeof overrides.$inferInsert

const scope = (connectionId: string | null) =>
  connectionId === null ? isNull(overrides.connectionId) : eq(overrides.connectionId, connectionId)

/**
 * Active overrides of a workspace (workspace-wide and per connection): not reset and not
 * expired at `now`. An expired override the scheduler has not closed yet is ignored.
 */
export async function findActiveOverrides(
  db: Executor,
  workspaceId: string,
  now: Date,
): Promise<Override[]> {
  return db
    .select()
    .from(overrides)
    .where(
      and(
        eq(overrides.workspaceId, workspaceId),
        isNull(overrides.resetAt),
        or(isNull(overrides.expiresAt), gt(overrides.expiresAt, now)),
      ),
    )
    .orderBy(asc(overrides.createdAt), asc(overrides.id))
}

/**
 * Closes the open override of one scope (`connectionId` null = workspace-wide), expired or
 * not, so the partial unique index admits a new one. Returns the closed rows.
 */
export async function closeOverride(
  db: Executor,
  workspaceId: string,
  connectionId: string | null,
  at: Date,
): Promise<Override[]> {
  return db
    .update(overrides)
    .set({ resetAt: at })
    .where(
      and(eq(overrides.workspaceId, workspaceId), scope(connectionId), isNull(overrides.resetAt)),
    )
    .returning()
}

export async function insertOverride(db: Executor, row: NewOverride): Promise<Override> {
  const [inserted] = await db.insert(overrides).values(row).returning()
  if (!inserted) throw new Error('override not inserted')
  return inserted
}

/** Scheduler pass: closes every open override past its TTL at its own expiry instant. */
export async function closeExpiredOverrides(db: Executor, now: Date): Promise<Override[]> {
  return db
    .update(overrides)
    .set({ resetAt: sql`${overrides.expiresAt}` })
    .where(
      and(isNull(overrides.resetAt), isNotNull(overrides.expiresAt), lte(overrides.expiresAt, now)),
    )
    .returning()
}

export interface StoredSettingsLayers {
  workspace: { simulation: unknown; rateLimit: (typeof workspaces.$inferSelect)['rateLimit'] }
  connection: {
    simulation: (typeof connections.$inferSelect)['simulation']
    rateLimit: (typeof connections.$inferSelect)['rateLimit']
  } | null
}

/** Stored simulation settings of a workspace and, optionally, one of its connections. */
export async function findSettingsLayers(
  db: Executor,
  workspaceId: string,
  connectionId: string | null,
): Promise<StoredSettingsLayers | undefined> {
  const [workspace] = await db
    .select({ simulation: workspaces.simulation, rateLimit: workspaces.rateLimit })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
  if (!workspace) return undefined
  if (connectionId === null) return { workspace, connection: null }
  const [connection] = await db
    .select({ simulation: connections.simulation, rateLimit: connections.rateLimit })
    .from(connections)
    .where(and(eq(connections.id, connectionId), eq(connections.workspaceId, workspaceId)))
  return { workspace, connection: connection ?? null }
}
