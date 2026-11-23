import { findWorkspaceByRef, type Workspace } from '@mailsink/db'
import { readSession } from '../../auth/session.server'
import type { Runtime } from '../../runtime/container'

// Guard of the inbox server routes (stream, downloads, preview): the UI session cookie,
// then the workspace of the URL by slug. Errors use the `{ error: { code, message } }` body
// of the other session routes (D162).

const refuse = (status: number, code: string, message: string) =>
  Response.json({ error: { code, message } }, { status, headers: { 'Cache-Control': 'no-store' } })

export type SessionWorkspace = { runtime: Runtime; workspace: Workspace }

/** The runtime and workspace, or the refusal to send (401 without session, 404 unknown). */
export async function sessionWorkspace(slug: string): Promise<SessionWorkspace | Response> {
  const { runtime, status } = await readSession()
  if (status !== 'signed-in') {
    return refuse(401, 'unauthorized', 'Sign in to the web UI first')
  }
  const workspace = await findWorkspaceByRef(runtime.db.db, slug)
  if (!workspace || workspace.slug !== slug) {
    return refuse(404, 'not_found', 'Workspace not found')
  }
  await runtime.activity.touch(workspace.id)
  return { runtime, workspace }
}

/** `not_found` domain errors (message, attachment, raw source) as a 404 refusal. */
export function notFound(message: string): Response {
  return refuse(404, 'not_found', message)
}
