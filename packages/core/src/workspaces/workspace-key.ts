import type { RotatedWorkspaceKey } from '@mailsink/contracts'
import {
  activeWorkspaceKeyPrefix,
  type Database,
  findWorkspaceByRef,
  insertApiKeys,
  newId,
  revokeWorkspaceKeys,
} from '@mailsink/db'
import { generateKey } from '../connections/credentials'
import { DomainError } from '../errors'

// Workspace key (`mskw_`, D12): Capture and MCP access of the whole workspace (#106).

async function workspaceIdOf(db: Database, ref: string): Promise<string> {
  const workspace = await findWorkspaceByRef(db, ref)
  if (!workspace) throw new DomainError('not_found', 'Workspace not found')
  return workspace.id
}

/**
 * New `mskw_` key, the previous ones revoked in the same transaction without grace period
 * (like connection keys, D172). The key is answered once; the database keeps its hash.
 */
export async function rotateWorkspaceKey(
  db: Database,
  ref: string,
  options: { now?: Date } = {},
): Promise<RotatedWorkspaceKey> {
  const now = options.now ?? new Date()
  const workspaceId = await workspaceIdOf(db, ref)
  const key = generateKey('workspace')
  await db.transaction(async (tx) => {
    await revokeWorkspaceKeys(tx, workspaceId, now)
    await insertApiKeys(tx, [
      {
        id: newId('key'),
        workspaceId,
        scope: 'workspace',
        displayPrefix: key.displayPrefix,
        hash: key.hash,
        createdAt: now,
      },
    ])
  })
  return { workspaceKey: key.key, keyPreview: `${key.displayPrefix}…` }
}

/** Preview of the active workspace key (`mskw_ab12…`), null when every key was revoked. */
export async function workspaceKeyPreview(db: Database, ref: string): Promise<string | null> {
  const prefix = await activeWorkspaceKeyPrefix(db, await workspaceIdOf(db, ref))
  return prefix ? `${prefix}…` : null
}
