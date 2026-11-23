import { ConnectionId, WorkspaceRef } from '@mailsink/contracts'
import { rotateConnectionCredentials } from '@mailsink/core'
import { z } from 'zod'
import { defineApi } from '../handler'
import { publicEndpoints } from './public-endpoints'

const Params = z.object({ id: WorkspaceRef, connectionId: ConnectionId })

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
