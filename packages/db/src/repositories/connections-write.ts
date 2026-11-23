import { and, eq, isNull } from 'drizzle-orm'
import type { Executor } from '../client'
import { connections } from '../schema/connections'
import { apiKeys } from '../schema/keys'
import type { Connection } from './connections'

// Changes to an existing connection (#38): the UI server functions and the Admin API.
// Every lookup is scoped to its workspace, so another workspace's connection is not found.

export type ConnectionPatch = Partial<Pick<Connection, 'name' | 'disabledAt' | 'smtpPasswordHash'>>

export async function findConnection(
  db: Executor,
  workspaceId: string,
  id: string,
): Promise<Connection | undefined> {
  const [row] = await db
    .select()
    .from(connections)
    .where(and(eq(connections.workspaceId, workspaceId), eq(connections.id, id)))
    .limit(1)
  return row
}

export async function updateConnection(
  db: Executor,
  workspaceId: string,
  id: string,
  patch: ConnectionPatch,
  now: Date = new Date(),
): Promise<Connection | undefined> {
  const [row] = await db
    .update(connections)
    .set({ ...patch, updatedAt: now })
    .where(and(eq(connections.workspaceId, workspaceId), eq(connections.id, id)))
    .returning()
  return row
}

/** Hard delete; its keys, endpoints and overrides cascade, messages and logs keep a null. */
export async function deleteConnection(
  db: Executor,
  workspaceId: string,
  id: string,
): Promise<boolean> {
  const rows = await db
    .delete(connections)
    .where(and(eq(connections.workspaceId, workspaceId), eq(connections.id, id)))
    .returning({ id: connections.id })
  return rows.length > 0
}

/** Revokes every active key of a connection; resolves with how many were revoked. */
export async function revokeConnectionKeys(
  db: Executor,
  connectionId: string,
  at: Date,
): Promise<number> {
  const rows = await db
    .update(apiKeys)
    .set({ revokedAt: at })
    .where(and(eq(apiKeys.connectionId, connectionId), isNull(apiKeys.revokedAt)))
    .returning({ id: apiKeys.id })
  return rows.length
}
