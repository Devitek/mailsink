import { and, desc, eq, isNull } from 'drizzle-orm'
import type { Executor } from '../client'
import { connections } from '../schema/connections'
import { apiKeys } from '../schema/keys'
import { workspaces } from '../schema/workspaces'
import type { Connection } from './connections'
import type { Workspace } from './workspaces'

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

export type NewApiKey = typeof apiKeys.$inferInsert

export async function insertApiKeys(db: Executor, rows: NewApiKey[]): Promise<ApiKey[]> {
  if (rows.length === 0) return []
  return db.insert(apiKeys).values(rows).returning()
}

/** `display_prefix` of the newest active connection key, per connection of a workspace. */
export async function activeKeyPrefixes(
  db: Executor,
  workspaceId: string,
): Promise<Map<string, string>> {
  const rows = await db
    .select({ connectionId: apiKeys.connectionId, displayPrefix: apiKeys.displayPrefix })
    .from(apiKeys)
    .where(
      and(
        eq(apiKeys.workspaceId, workspaceId),
        eq(apiKeys.scope, 'connection'),
        isNull(apiKeys.revokedAt),
      ),
    )
    .orderBy(desc(apiKeys.createdAt), desc(apiKeys.id))
  const out = new Map<string, string>()
  for (const row of rows) {
    if (row.connectionId && !out.has(row.connectionId)) out.set(row.connectionId, row.displayPrefix)
  }
  return out
}
