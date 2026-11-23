import type { UpdateWorkspaceRequest, WorkspaceView } from '@mailsink/contracts'
import { type Database, findWorkspaceByRef, updateWorkspace } from '@mailsink/db'
import { DomainError } from '../errors'
import { toWorkspaceView } from './views'

/**
 * Edits the settings of a workspace named by id or slug (#38, #43): name, description, default
 * retention, message quota, rate limit and default simulation (replaced whole). Ephemeral
 * ones too; the slug and the lifetime do not change.
 */
export async function updateWorkspaceSettings(
  db: Database,
  ref: string,
  patch: UpdateWorkspaceRequest,
  publicUrl: string,
  now: Date = new Date(),
): Promise<WorkspaceView> {
  const workspace = await findWorkspaceByRef(db, ref)
  const row =
    workspace &&
    (await updateWorkspace(
      db,
      workspace.id,
      {
        name: patch.name,
        description: patch.description,
        retentionSeconds: patch.retention,
        rateLimit: patch.rateLimit,
        maxMessages: patch.maxMessages,
        simulation: patch.simulation,
      },
      now,
    ))
  if (!row) throw new DomainError('not_found', 'Workspace not found')
  return toWorkspaceView(row, publicUrl)
}
