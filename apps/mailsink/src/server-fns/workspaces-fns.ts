import { createMiddleware, createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSession } from '../auth/session.server'
import { openWorkspace, readWorkspacePage } from './workspaces.server'

// Workspace server functions of the UI. Each one checks the session itself: route guards
// redirect first, this is the backstop for a direct call.

export const signedIn = createMiddleware({ type: 'function' }).server(async ({ next }) =>
  next({ context: { runtime: await requireSession() } }),
)

export const listWorkspacesFn = createServerFn({ method: 'GET' })
  .middleware([signedIn])
  .validator(
    z.object({
      ephemeral: z.boolean(),
      q: z.string().trim().max(200).optional(),
      cursor: z.string().max(64).optional(),
    }),
  )
  .handler(({ context, data }) => readWorkspacePage(context.runtime, data))

export const openWorkspaceFn = createServerFn({ method: 'GET' })
  .middleware([signedIn])
  .validator(z.object({ slug: z.string().min(1).max(200) }))
  .handler(({ context, data }) => openWorkspace(context.runtime, data.slug))
