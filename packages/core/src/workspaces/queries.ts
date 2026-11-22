import type { WorkspaceDetail, WorkspaceView } from '@mailsink/contracts'
import {
  activeKeyPrefixes,
  type Database,
  deleteWorkspace,
  findWorkspaceByRef,
  listConnections,
  listWorkspaces,
} from '@mailsink/db'
import { DomainError } from '../errors'
import { toConnectionView, toWorkspaceView } from './views'

export interface ListWorkspacesInput {
  includeEphemeral: boolean
  cursor?: string
  limit: number
}

/** One page, newest first; `nextCursor` is the id of the last item when more may follow. */
export async function listWorkspaceViews(
  db: Database,
  input: ListWorkspacesInput,
  publicUrl: string,
): Promise<{ data: WorkspaceView[]; nextCursor: string | null }> {
  const rows = await listWorkspaces(db, {
    includeEphemeral: input.includeEphemeral,
    after: input.cursor,
    limit: input.limit + 1,
  })
  const page = rows.slice(0, input.limit)
  const last = page.at(-1)
  return {
    data: page.map((row) => toWorkspaceView(row, publicUrl)),
    nextCursor: rows.length > input.limit && last ? last.id : null,
  }
}

const notFound = () => new DomainError('not_found', 'Workspace not found')

/** Workspace by id or slug, with its connections (`GET /admin/workspaces/:id`). */
export async function getWorkspaceDetail(
  db: Database,
  ref: string,
  publicUrl: string,
): Promise<WorkspaceDetail> {
  const workspace = await findWorkspaceByRef(db, ref)
  if (!workspace) throw notFound()
  const [connections, prefixes] = await Promise.all([
    listConnections(db, workspace.id),
    activeKeyPrefixes(db, workspace.id),
  ])
  return {
    ...toWorkspaceView(workspace, publicUrl),
    connections: connections.map((c) => toConnectionView(c, prefixes.get(c.id))),
  }
}

/** Immediate hard delete by id or slug; connections, keys, messages and logs cascade. */
export async function removeWorkspace(db: Database, ref: string): Promise<void> {
  const workspace = await findWorkspaceByRef(db, ref)
  if (!workspace || !(await deleteWorkspace(db, workspace.id))) throw notFound()
}
