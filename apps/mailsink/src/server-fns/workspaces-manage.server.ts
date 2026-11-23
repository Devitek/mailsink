import type { CreateWorkspaceRequest, UpdateWorkspaceRequest } from '@mailsink/contracts'
import { createWorkspace, updateWorkspaceSettings } from '@mailsink/core'
import { publicEndpoints } from '../http/admin/public-endpoints'
import { removeWorkspaceAndNotify } from '../http/admin/workspaces'
import type { Runtime } from '../runtime/container'
import { conflictOf, touchWorkspace, toWorkspaceSettings } from './connections.server'
import type { Conflict, CreatedWorkspace, WorkspaceSettings } from './connections-types'

// Workspace management of the web UI (#38): create a persistent workspace (ephemeral ones
// come from the Admin API), edit its settings, delete it (ephemeral ones too).

export async function createWorkspaceFromUi(
  runtime: Runtime,
  input: CreateWorkspaceRequest,
): Promise<CreatedWorkspace | Conflict> {
  try {
    const created = await createWorkspace(
      runtime.db.db,
      { ...input, ephemeral: false, idleTtlSeconds: undefined },
      {
        endpoints: publicEndpoints(runtime),
        defaultIdleTtlSeconds: runtime.config.defaultIdleTtlSeconds,
        createdVia: 'ui',
      },
    )
    return {
      ok: true,
      slug: created.workspace.slug,
      workspaceKey: created.workspaceKey,
      connections: created.connections,
    }
  } catch (error) {
    const conflict = conflictOf(error)
    if (conflict) return conflict
    throw error
  }
}

export async function editWorkspace(
  runtime: Runtime,
  slug: string,
  patch: UpdateWorkspaceRequest,
): Promise<WorkspaceSettings> {
  const workspaceId = await touchWorkspace(runtime, slug)
  const view = await updateWorkspaceSettings(
    runtime.db.db,
    workspaceId,
    patch,
    runtime.config.publicUrl,
  )
  return toWorkspaceSettings(view)
}

/** Hard delete, with the `workspace.deleted` event of the Admin API (D97). */
export async function deleteWorkspaceFromUi(runtime: Runtime, slug: string): Promise<void> {
  const workspaceId = await touchWorkspace(runtime, slug)
  await removeWorkspaceAndNotify(runtime, workspaceId)
}
