import { findWorkspaceByRef, listWorkspaces, type Workspace } from '@mailsink/db'
import { getCookie, setCookie } from '@tanstack/react-start/server'
import type { Runtime } from '../runtime/container'
import type { WorkspaceList, WorkspaceSummary } from './workspace-types'

// Workspace reads of the UI server functions (not defineApi routes, so the activity touch
// of D86 is done here explicitly).

/** Last workspace opened in this browser: the default page after signing in (L1d). */
export const LAST_WORKSPACE_COOKIE = 'mailsink_last_workspace'

/** Workspaces listed by the picker; beyond that, CI leftovers are not worth listing. */
export const PICKER_LIMIT = 500

const summary = (w: Workspace): WorkspaceSummary => ({
  id: w.id,
  slug: w.slug,
  name: w.name,
  ephemeral: w.ephemeral,
  expiresAt: w.expiresAt?.toISOString() ?? null,
})

export async function readWorkspaceList(
  runtime: Runtime,
  { ephemeral }: { ephemeral: boolean },
): Promise<WorkspaceList> {
  const all = await listWorkspaces(runtime.db.db, { includeEphemeral: true, limit: PICKER_LIMIT })
  const persistent = all.filter((w) => !w.ephemeral)
  const ephemerals = all.filter((w) => w.ephemeral)
  return {
    persistent: persistent.map(summary),
    ephemeral: ephemeral ? ephemerals.map(summary) : [],
    ephemeralCount: ephemerals.length,
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
  setCookie(LAST_WORKSPACE_COOKIE, workspace.slug, {
    path: '/',
    maxAge: 365 * 86_400,
    sameSite: 'lax',
    httpOnly: true,
  })
  return summary(workspace)
}

export async function lastWorkspaceHome(runtime: Runtime): Promise<string> {
  const slug = getCookie(LAST_WORKSPACE_COOKIE)
  const workspace = slug ? await findWorkspaceByRef(runtime.db.db, slug) : undefined
  return workspace && workspace.slug === slug ? `/w/${encodeURIComponent(slug)}` : '/'
}
