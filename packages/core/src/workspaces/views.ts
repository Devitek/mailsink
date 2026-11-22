import type { ConnectionView, WorkspaceView } from '@mailsink/contracts'
import type { Connection, Workspace } from '@mailsink/db'

const iso = (date: Date) => date.toISOString()
const isoOrNull = (date: Date | null) => (date ? date.toISOString() : null)

/** Links of a workspace (D35): UI page, Capture API root and MCP endpoint. */
export function workspaceUrls(publicUrl: string, slug: string): WorkspaceView['urls'] {
  return { ui: `${publicUrl}/w/${slug}`, capture: `${publicUrl}/capture`, mcp: `${publicUrl}/mcp` }
}

export function toWorkspaceView(row: Workspace, publicUrl: string): WorkspaceView {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    ephemeral: row.ephemeral,
    idleTtlSeconds: row.idleTtlSeconds,
    expiresAt: isoOrNull(row.expiresAt),
    lastActivityAt: iso(row.lastActivityAt),
    retentionSeconds: row.retentionSeconds,
    maxMessages: row.maxMessages,
    rateLimit: row.rateLimit,
    simulation: row.simulation,
    metadata: row.metadata,
    urls: workspaceUrls(publicUrl, row.slug),
    createdAt: iso(row.createdAt),
  }
}

/** `keyPreview`: display prefix of the active key followed by `…`, null without a key. */
export function toConnectionView(row: Connection, displayPrefix?: string): ConnectionView {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    smtpUsername: row.smtpUsername,
    keyPreview: displayPrefix ? `${displayPrefix}…` : null,
    retentionSeconds: row.retentionSeconds,
    rateLimit: row.rateLimit,
    simulation: row.simulation,
    disabledAt: isoOrNull(row.disabledAt),
    createdAt: iso(row.createdAt),
  }
}
