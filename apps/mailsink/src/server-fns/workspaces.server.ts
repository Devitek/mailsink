import {
  countEphemeralWorkspaces,
  countMessagesByWorkspace,
  findWorkspaceByRef,
  listWorkspaces,
  type Workspace,
} from '@mailsink/db'
import { startServer } from '../http/start-server'
import type { Runtime } from '../runtime/container'
import type { WorkspacePage, WorkspaceSummary } from './workspace-types'

// Workspace reads of the UI server functions (not defineApi routes, so the activity touch
// of D86 is done here explicitly).

/** Last workspace opened in this browser: the default page after signing in (L1d). */
export const LAST_WORKSPACE_COOKIE = 'mailsink_last_workspace'

/** Workspaces per picker page (each section pages on its own, #104). */
export const PICKER_PAGE_SIZE = 50

const summary = (w: Workspace): WorkspaceSummary => ({
  id: w.id,
  slug: w.slug,
  name: w.name,
  ephemeral: w.ephemeral,
  expiresAt: w.expiresAt?.toISOString() ?? null,
})

export type WorkspacePageQuery = {
  /** The section: ephemeral or persistent workspaces, read apart (#104). */
  ephemeral: boolean
  /** Substring of the slug or the name. */
  q?: string
  /** `nextCursor` of the previous page. */
  cursor?: string
}

/**
 * One page of a picker section. Persistent and ephemeral workspaces are read apart, so CI
 * leftovers never push persistent ones out of the list; ephemeral ones are counted by an
 * aggregate.
 */
export async function readWorkspacePage(
  runtime: Runtime,
  { ephemeral, q, cursor }: WorkspacePageQuery,
): Promise<WorkspacePage> {
  const db = runtime.db.db
  const [rows, ephemeralCount] = await Promise.all([
    listWorkspaces(db, {
      includeEphemeral: false,
      onlyEphemeral: ephemeral,
      search: q,
      after: cursor,
      limit: PICKER_PAGE_SIZE + 1,
    }),
    countEphemeralWorkspaces(db),
  ])
  const page = rows.slice(0, PICKER_PAGE_SIZE)
  const nextCursor = rows.length > PICKER_PAGE_SIZE ? (page.at(-1)?.id ?? null) : null
  if (ephemeral) return { data: page.map(summary), nextCursor, ephemeralCount }
  // Ephemeral rows show their TTL instead (prototype), so only persistent ones are counted.
  const counts = await countMessagesByWorkspace(
    db,
    page.map((w) => w.id),
  )
  return {
    data: page.map((w) => ({ ...summary(w), messageCount: counts.get(w.id) ?? 0 })),
    nextCursor,
    ephemeralCount,
  }
}

/**
 * Opens a workspace from the UI: touches its activity (an ephemeral workspace looked at in
 * the browser does not expire meanwhile) and remembers it as the last one.
 */
export async function openWorkspace(
  runtime: Runtime,
  slug: string,
): Promise<WorkspaceSummary | null> {
  const workspace = await findWorkspaceByRef(runtime.db.db, slug)
  if (!workspace || workspace.slug !== slug) return null
  await runtime.activity.touch(workspace.id)
  const { setCookie } = await startServer()
  // Just touched: an ephemeral workspace now lives a whole idle TTL from now (D16).
  const ttl = workspace.idleTtlSeconds
  const expiresAt =
    workspace.ephemeral && ttl !== null
      ? new Date(Math.max(workspace.expiresAt?.getTime() ?? 0, Date.now() + ttl * 1000))
      : workspace.expiresAt
  setCookie(LAST_WORKSPACE_COOKIE, workspace.slug, {
    path: '/',
    maxAge: 365 * 86_400,
    sameSite: 'lax',
    httpOnly: true,
  })
  return { ...summary({ ...workspace, expiresAt }), idleTtlSeconds: ttl }
}

export async function lastWorkspaceHome(runtime: Runtime): Promise<string> {
  const { getCookie } = await startServer()
  const slug = getCookie(LAST_WORKSPACE_COOKIE)
  const workspace = slug ? await findWorkspaceByRef(runtime.db.db, slug) : undefined
  return workspace && workspace.slug === slug ? `/w/${encodeURIComponent(slug)}` : '/'
}
