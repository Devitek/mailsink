import { Slug, UpdateWorkspaceRequest } from '@mailsink/contracts'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { readSettingsPage, saveWorkspaceDefaults } from './settings.server'
import { signedIn } from './workspaces-fns'

// Workspace settings server functions (#43), session-checked, on the core services.

export const readSettingsFn = createServerFn({ method: 'GET' })
  .middleware([signedIn])
  .validator(z.object({ slug: z.string().min(1).max(200) }))
  .handler(({ context, data }) => readSettingsPage(context.runtime, data.slug))

export const saveDefaultsFn = createServerFn({ method: 'POST' })
  .middleware([signedIn])
  .validator(z.object({ slug: Slug, patch: UpdateWorkspaceRequest }))
  .handler(({ context, data }) => saveWorkspaceDefaults(context.runtime, data.slug, data.patch))
