import { ConnectionId, ConnectionInput, Slug, UpdateConnectionRequest } from '@mailsink/contracts'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import {
  changeConnection,
  createConnection,
  deleteConnection,
  readConnectionsPage,
  rotateConnection,
} from './connections.server'
import { signedIn } from './workspaces-fns'

// Connection management server functions (#38), session-checked, on the core services.

const Target = z.object({ slug: Slug, id: ConnectionId })

export const listConnectionsFn = createServerFn({ method: 'GET' })
  .middleware([signedIn])
  .validator(z.object({ slug: z.string().min(1).max(200) }))
  .handler(({ context, data }) => readConnectionsPage(context.runtime, data.slug))

export const createConnectionFn = createServerFn({ method: 'POST' })
  .middleware([signedIn])
  .validator(z.object({ slug: Slug, connection: ConnectionInput }))
  .handler(({ context, data }) => createConnection(context.runtime, data.slug, data.connection))

export const updateConnectionFn = createServerFn({ method: 'POST' })
  .middleware([signedIn])
  .validator(Target.extend({ patch: UpdateConnectionRequest }))
  .handler(({ context, data }) => changeConnection(context.runtime, data.slug, data.id, data.patch))

export const rotateConnectionFn = createServerFn({ method: 'POST' })
  .middleware([signedIn])
  .validator(Target)
  .handler(({ context, data }) => rotateConnection(context.runtime, data.slug, data.id))

export const deleteConnectionFn = createServerFn({ method: 'POST' })
  .middleware([signedIn])
  .validator(Target)
  .handler(({ context, data }) => deleteConnection(context.runtime, data.slug, data.id))
