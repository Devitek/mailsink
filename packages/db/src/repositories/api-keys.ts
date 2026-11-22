import { and, eq, isNull, or } from 'drizzle-orm'
import type { Executor } from '../client'
import { connections } from '../schema/connections'
import { apiKeys } from '../schema/keys'
import { workspaces } from '../schema/workspaces'

export type Workspace = typeof workspaces.$inferSelect
export type Connection = typeof connections.$inferSelect
export type ApiKey = typeof apiKeys.$inferSelect

export interface ActiveApiKey {
  key: ApiKey
  workspace: Workspace
  /** Set for connection keys (`msk_`), null for workspace keys (`mskw_`, D12). */
  connection: Connection | null
}

/** Non-revoked key with the given SHA-256 hash (D11), with its workspace and connection. */
export async function findActiveApiKeyByHash(
  db: Executor,
  hash: string,
): Promise<ActiveApiKey | undefined> {
  const [row] = await db
    .select({ key: apiKeys, workspace: workspaces, connection: connections })
    .from(apiKeys)
    .innerJoin(workspaces, eq(workspaces.id, apiKeys.workspaceId))
    .leftJoin(connections, eq(connections.id, apiKeys.connectionId))
    .where(and(eq(apiKeys.hash, hash), isNull(apiKeys.revokedAt)))
    .limit(1)
  return row
}

/**
 * Workspace named by `X-Mailsink-Workspace` (id or slug) when the Admin key acts on it (D12).
 * Lives here until the workspaces repository lands with the Admin API (#13).
 */
export async function findWorkspaceByRef(
  db: Executor,
  ref: string,
): Promise<Workspace | undefined> {
  const [row] = await db
    .select()
    .from(workspaces)
    .where(or(eq(workspaces.id, ref), eq(workspaces.slug, ref)))
    .limit(1)
  return row
}
