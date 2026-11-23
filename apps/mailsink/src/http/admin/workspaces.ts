import {
  CreateWorkspaceRequest,
  ListWorkspacesQuery,
  UpdateWorkspaceRequest,
  WorkspaceRef,
} from '@mailsink/contracts'
import {
  createWorkspace,
  getWorkspaceDetail,
  listWorkspaceViews,
  removeWorkspace,
  rotateWorkspaceKey,
  updateWorkspaceSettings,
} from '@mailsink/core'
import { z } from 'zod'
import type { Runtime } from '../../runtime/container'
import { defineApi } from '../handler'
import { publicEndpoints } from './public-endpoints'

const RefParams = z.object({ id: WorkspaceRef })

/** `POST /admin/workspaces`: workspace, connections and secrets (shown once), 201. */
export const postWorkspace = defineApi({
  auth: 'admin',
  body: CreateWorkspaceRequest,
  handler: async ({ runtime, body }) => {
    const created = await createWorkspace(runtime.db.db, body, {
      endpoints: publicEndpoints(runtime),
      defaultIdleTtlSeconds: runtime.config.defaultIdleTtlSeconds,
    })
    return Response.json(created, { status: 201 })
  },
})

/** `GET /admin/workspaces?includeEphemeral=&cursor=&limit=`. */
export const listWorkspaces = defineApi({
  auth: 'admin',
  query: ListWorkspacesQuery,
  handler: ({ runtime, query }) =>
    listWorkspaceViews(runtime.db.db, query, runtime.config.publicUrl),
})

/** `GET /admin/workspaces/:id` (id or slug). */
export const getWorkspace = defineApi({
  auth: 'admin',
  params: RefParams,
  handler: ({ runtime, params }) =>
    getWorkspaceDetail(runtime.db.db, params.id, runtime.config.publicUrl),
})

/** `PATCH /admin/workspaces/:id`: name, description, retention, rate limit (#106). */
export const patchWorkspace = defineApi({
  auth: 'admin',
  params: RefParams,
  body: UpdateWorkspaceRequest,
  handler: ({ runtime, params, body }) =>
    updateWorkspaceSettings(runtime.db.db, params.id, body, runtime.config.publicUrl),
})

/** `POST /admin/workspaces/:id/key/rotate`: a new `mskw_` key, the previous one revoked. */
export const rotateWorkspaceKeyApi = defineApi({
  auth: 'admin',
  params: RefParams,
  handler: ({ runtime, params }) => rotateWorkspaceKey(runtime.db.db, params.id),
})

/**
 * Immediate hard delete by id or slug. Like the ephemeral GC, it publishes
 * `workspace.deleted` so open streams and `wait=true` calls end (D97). Also used by the UI.
 */
export async function removeWorkspaceAndNotify(runtime: Runtime, ref: string): Promise<string> {
  const workspaceId = await removeWorkspace(runtime.db.db, ref)
  runtime.activity.forget(workspaceId)
  runtime.bus.publish(workspaceId, {
    id: null,
    connectionId: null,
    event: { type: 'workspace.deleted', workspaceId },
  })
  return workspaceId
}

/** `DELETE /admin/workspaces/:id`: 204. */
export const deleteWorkspace = defineApi({
  auth: 'admin',
  params: RefParams,
  handler: async ({ runtime, params }) => {
    await removeWorkspaceAndNotify(runtime, params.id)
    return new Response(null, { status: 204 })
  },
})
