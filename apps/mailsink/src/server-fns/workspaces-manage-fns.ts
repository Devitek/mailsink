import { CreateWorkspaceRequest, Slug, UpdateWorkspaceRequest } from '@mailsink/contracts'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { signedIn } from './workspaces-fns'
import {
  createWorkspaceFromUi,
  deleteWorkspaceFromUi,
  editWorkspace,
  rotateWorkspaceKeyFromUi,
} from './workspaces-manage.server'

// Workspace management server functions (#38): the browser never holds the admin key, these
// run with the session (`signedIn`) and call the core services directly.

export const createWorkspaceFn = createServerFn({ method: 'POST' })
  .middleware([signedIn])
  .validator(CreateWorkspaceRequest)
  .handler(({ context, data }) => createWorkspaceFromUi(context.runtime, data))

export const updateWorkspaceFn = createServerFn({ method: 'POST' })
  .middleware([signedIn])
  .validator(z.object({ slug: Slug, patch: UpdateWorkspaceRequest }))
  .handler(({ context, data }) => editWorkspace(context.runtime, data.slug, data.patch))

export const deleteWorkspaceFn = createServerFn({ method: 'POST' })
  .middleware([signedIn])
  .validator(z.object({ slug: Slug }))
  .handler(({ context, data }) => deleteWorkspaceFromUi(context.runtime, data.slug))

export const rotateWorkspaceKeyFn = createServerFn({ method: 'POST' })
  .middleware([signedIn])
  .validator(z.object({ slug: Slug }))
  .handler(({ context, data }) => rotateWorkspaceKeyFromUi(context.runtime, data.slug))
