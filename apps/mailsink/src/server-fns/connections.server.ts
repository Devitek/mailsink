import type {
  ConnectionInput,
  ConnectionView,
  CreatedConnection,
  UpdateConnectionRequest,
  WorkspaceView,
} from '@mailsink/contracts'
import {
  addConnection,
  buildCredentials,
  DomainError,
  envSnippet,
  getWorkspaceDetail,
  isDomainError,
  type PublicEndpoints,
  removeConnection,
  rotateConnectionCredentials,
  updateConnectionSettings,
} from '@mailsink/core'
import { findWorkspaceByRef } from '@mailsink/db'
import { publicEndpoints } from '../http/admin/public-endpoints'
import type { Runtime } from '../runtime/container'
import type {
  Conflict,
  ConnectionCreation,
  ConnectionRow,
  ConnectionSetup,
  ConnectionsPage,
  WorkspaceSettings,
} from './connections-types'

// Connection management of the web UI (#38): server functions call these with the runtime
// of a signed-in session. Workspaces are named by slug only, like `/w/$workspaceSlug`; every
// call touches the workspace activity (D86, D163).

/** Workspace id of a slug, touched; `not_found` for an id or an unknown slug. */
export async function touchWorkspace(runtime: Runtime, slug: string): Promise<string> {
  const workspace = await findWorkspaceByRef(runtime.db.db, slug)
  if (!workspace || workspace.slug !== slug) {
    throw new DomainError('not_found', 'Workspace not found')
  }
  await runtime.activity.touch(workspace.id)
  return workspace.id
}

const MASKED_PASSWORD = '••••••••••••••••'

function setupOf(view: ConnectionView, endpoints: PublicEndpoints): ConnectionSetup {
  if (view.kind === 'smtp') {
    const { smtpHost, smtpPort } = endpoints
    return { kind: 'smtp', smtpHost, smtpPort, smtpUser: view.smtpUsername ?? '' }
  }
  const credentials = buildCredentials({ kind: view.kind, apiKey: '' }, endpoints)
  return { kind: view.kind, baseUrl: credentials.kind === 'smtp' ? '' : credentials.baseUrl }
}

export function toConnectionRow(view: ConnectionView, endpoints: PublicEndpoints): ConnectionRow {
  const secrets =
    view.kind === 'smtp'
      ? { kind: 'smtp' as const, smtpUser: view.smtpUsername ?? '', smtpPass: MASKED_PASSWORD }
      : { kind: view.kind, apiKey: view.keyPreview ?? 'msk_…' }
  return {
    ...view,
    setup: setupOf(view, endpoints),
    maskedSnippet: envSnippet(buildCredentials(secrets, endpoints)),
  }
}

export const toWorkspaceSettings = (w: WorkspaceView): WorkspaceSettings => ({
  id: w.id,
  slug: w.slug,
  name: w.name,
  description: w.description,
  ephemeral: w.ephemeral,
  expiresAt: w.expiresAt,
  retentionSeconds: w.retentionSeconds,
  rateLimit: w.rateLimit,
})

export async function readConnectionsPage(
  runtime: Runtime,
  slug: string,
): Promise<ConnectionsPage | null> {
  const workspace = await findWorkspaceByRef(runtime.db.db, slug)
  if (!workspace || workspace.slug !== slug) return null
  await runtime.activity.touch(workspace.id)
  const detail = await getWorkspaceDetail(runtime.db.db, workspace.id, runtime.config.publicUrl)
  const endpoints = publicEndpoints(runtime)
  return {
    workspace: toWorkspaceSettings(detail),
    connections: detail.connections.map((c) => toConnectionRow(c, endpoints)),
  }
}

/** A taken slug or SMTP username, as a field-level answer instead of a failure. */
export function conflictOf(error: unknown): Conflict | null {
  if (!isDomainError(error) || error.code !== 'conflict') return null
  return { ok: false, conflict: /slug/i.test(error.message) ? 'slug' : 'smtp_username' }
}

export async function createConnection(
  runtime: Runtime,
  slug: string,
  input: ConnectionInput,
): Promise<ConnectionCreation> {
  const workspaceId = await touchWorkspace(runtime, slug)
  try {
    const connection = await addConnection(runtime.db.db, workspaceId, input, {
      endpoints: publicEndpoints(runtime),
    })
    return { ok: true, connection }
  } catch (error) {
    const conflict = conflictOf(error)
    if (conflict) return conflict
    throw error
  }
}

export async function changeConnection(
  runtime: Runtime,
  slug: string,
  id: string,
  patch: UpdateConnectionRequest,
): Promise<ConnectionRow> {
  const workspaceId = await touchWorkspace(runtime, slug)
  const view = await updateConnectionSettings(runtime.db.db, workspaceId, id, patch)
  return toConnectionRow(view, publicEndpoints(runtime))
}

export async function rotateConnection(
  runtime: Runtime,
  slug: string,
  id: string,
): Promise<CreatedConnection> {
  const workspaceId = await touchWorkspace(runtime, slug)
  return rotateConnectionCredentials(runtime.db.db, workspaceId, id, {
    endpoints: publicEndpoints(runtime),
  })
}

export async function deleteConnection(runtime: Runtime, slug: string, id: string) {
  const workspaceId = await touchWorkspace(runtime, slug)
  await removeConnection(runtime.db.db, workspaceId, id)
}
