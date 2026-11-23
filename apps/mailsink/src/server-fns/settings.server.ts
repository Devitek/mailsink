import type { UpdateWorkspaceRequest } from '@mailsink/contracts'
import { getWorkspaceDetail, updateWorkspaceSettings } from '@mailsink/core'
import { countMessagesByWorkspace, findWorkspaceByRef } from '@mailsink/db'
import type { Runtime } from '../runtime/container'
import { touchWorkspace } from './connections.server'
import { eventCatalog } from './settings-catalog'
import type { SettingsPage } from './settings-types'

// Workspace settings of the web UI (#43): read the page, save the defaults (retention,
// message quota, rate limit, default simulation). Named by slug, activity touched (D163).

export async function readSettingsPage(
  runtime: Runtime,
  slug: string,
): Promise<SettingsPage | null> {
  const found = await findWorkspaceByRef(runtime.db.db, slug)
  if (!found || found.slug !== slug) return null
  await runtime.activity.touch(found.id)
  const { publicUrl } = runtime.config
  const detail = await getWorkspaceDetail(runtime.db.db, found.id, publicUrl)
  const counts = await countMessagesByWorkspace(runtime.db.db, [found.id])
  return {
    workspace: {
      id: detail.id,
      slug: detail.slug,
      name: detail.name,
      retentionSeconds: detail.retentionSeconds,
      maxMessages: detail.maxMessages,
      rateLimit: detail.rateLimit,
      simulation: detail.simulation,
      messageCount: counts.get(found.id) ?? 0,
      publicUrl,
      mcpUrl: detail.urls.mcp,
    },
    connections: detail.connections.map((c) => ({
      id: c.id,
      name: c.name,
      kind: c.kind,
      disabled: c.disabledAt !== null,
    })),
    eventCatalog: eventCatalog(),
  }
}

export async function saveWorkspaceDefaults(
  runtime: Runtime,
  slug: string,
  patch: UpdateWorkspaceRequest,
): Promise<void> {
  const workspaceId = await touchWorkspace(runtime, slug)
  await updateWorkspaceSettings(runtime.db.db, workspaceId, patch, runtime.config.publicUrl)
}
