import { asc, eq } from 'drizzle-orm'
import type { Executor } from '../client'
import { connections } from '../schema/connections'

export type Connection = typeof connections.$inferSelect
export type NewConnection = typeof connections.$inferInsert

export async function insertConnections(
  db: Executor,
  rows: NewConnection[],
): Promise<Connection[]> {
  if (rows.length === 0) return []
  return db.insert(connections).values(rows).returning()
}

/** Connections of a workspace, oldest first. */
export async function listConnections(db: Executor, workspaceId: string): Promise<Connection[]> {
  return db
    .select()
    .from(connections)
    .where(eq(connections.workspaceId, workspaceId))
    .orderBy(asc(connections.createdAt), asc(connections.id))
}
