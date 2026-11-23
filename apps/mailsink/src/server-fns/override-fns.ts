import { ActivateOverrideRequest, ConnectionId } from '@mailsink/contracts'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { applyOverride, readOverridePanel, resetOverrideScopes } from './override.server'
import { signedIn } from './workspaces-fns'

// Override panel server functions (#42), session-checked, on the core override services.

const Slug = z.string().min(1).max(200)

export const readOverrideFn = createServerFn({ method: 'GET' })
  .middleware([signedIn])
  .validator(z.object({ slug: Slug }))
  .handler(({ context, data }) => readOverridePanel(context.runtime, data.slug))

export const applyOverrideFn = createServerFn({ method: 'POST' })
  .middleware([signedIn])
  .validator(z.object({ slug: Slug, request: ActivateOverrideRequest }))
  .handler(({ context, data }) => applyOverride(context.runtime, data.slug, data.request))

/** `scopes`: null for the workspace-wide override, else connection ids. */
export const resetOverrideFn = createServerFn({ method: 'POST' })
  .middleware([signedIn])
  .validator(z.object({ slug: Slug, scopes: z.array(ConnectionId.nullable()).min(1).max(100) }))
  .handler(({ context, data }) => resetOverrideScopes(context.runtime, data.slug, data.scopes))
