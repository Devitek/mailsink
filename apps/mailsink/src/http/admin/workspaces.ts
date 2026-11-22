import {
  CreateWorkspaceRequest,
  ListWorkspacesQuery,
  WorkspaceRef,
} from '@mailsink/contracts'
import {
  createWorkspace,
  getWorkspaceDetail,
  listWorkspaceViews,
  removeWorkspace,
} from '@mailsink/core'
import { z } from 'zod'
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

/** `DELETE /admin/workspaces/:id`: immediate hard delete, 204. */
export const deleteWorkspace = defineApi({
  auth: 'admin',
  params: RefParams,
  handler: async ({ runtime, params }) => {
    await removeWorkspace(runtime.db.db, params.id)
    return new Response(null, { status: 204 })
  },
})
