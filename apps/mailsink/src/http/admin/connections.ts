import {
  ConnectionId,
  ConnectionInput,
  UpdateConnectionRequest,
  WorkspaceRef,
} from '@mailsink/contracts'
import {
  addConnection,
  removeConnection,
  rotateConnectionCredentials,
  updateConnectionSettings,
} from '@mailsink/core'
import { z } from 'zod'
import { defineApi } from '../handler'
import { publicEndpoints } from './public-endpoints'

// Connections of an existing workspace through the Admin API: the same core services as
// the web UI (#38), so both surfaces can do the same (owner decision of 23/11, #105).

const WorkspaceParams = z.object({ id: WorkspaceRef })
const Params = z.object({ id: WorkspaceRef, connectionId: ConnectionId })

/** `POST /admin/workspaces/:id/connections`: 201 `CreatedConnection`, secrets once. */
export const postConnection = defineApi({
  auth: 'admin',
  params: WorkspaceParams,
  body: ConnectionInput,
  handler: async ({ runtime, params, body }) => {
    const created = await addConnection(runtime.db.db, params.id, body, {
      endpoints: publicEndpoints(runtime),
    })
    return Response.json(created, { status: 201 })
  },
})

/** `PATCH /admin/workspaces/:id/connections/:connectionId`: rename, disable, enable. */
export const patchConnection = defineApi({
  auth: 'admin',
  params: Params,
  body: UpdateConnectionRequest,
  handler: ({ runtime, params, body }) =>
    updateConnectionSettings(runtime.db.db, params.id, params.connectionId, body),
})

/** `DELETE /admin/workspaces/:id/connections/:connectionId`: hard delete (D173), 204. */
export const deleteConnection = defineApi({
  auth: 'admin',
  params: Params,
  handler: async ({ runtime, params }) => {
    await removeConnection(runtime.db.db, params.id, params.connectionId)
    return new Response(null, { status: 204 })
  },
})

/**
 * `POST /admin/workspaces/:id/connections/:connectionId/rotate` (#38): a new `msk_` key
 * (previous keys revoked at once) or SMTP password; 200 `CreatedConnection`, secrets once.
 */
export const rotateConnection = defineApi({
  auth: 'admin',
  params: Params,
  handler: async ({ runtime, params }) =>
    rotateConnectionCredentials(runtime.db.db, params.id, params.connectionId, {
      endpoints: publicEndpoints(runtime),
    }),
})
