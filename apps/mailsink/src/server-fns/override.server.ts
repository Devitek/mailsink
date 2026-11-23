import {
  type ActivateOverrideRequest,
  type OverrideState,
  SimulationSettings,
} from '@mailsink/contracts'
import {
  activateAndPublishOverride,
  getOverrideState,
  resetAndPublishOverride,
} from '@mailsink/core'
import { findWorkspaceByRef, listConnections } from '@mailsink/db'
import type { Runtime } from '../runtime/container'
import { workspaceOfSlug } from './messages.server'
import type { OverridePanel } from './override-types'

// Override panel of the web UI (#42): the core override services with origin `ui`, scoped to
// the workspace of the URL (by slug, activity touched). Activations and resets publish
// `override.changed` exactly like `POST /capture/override` (D96, D180).

const live = (runtime: Runtime) => ({ db: runtime.db.db, bus: runtime.bus })

/** Null for an unknown slug (the panel is simply not shown). */
export async function readOverridePanel(
  runtime: Runtime,
  slug: string,
): Promise<OverridePanel | null> {
  const workspace = await findWorkspaceByRef(runtime.db.db, slug)
  if (!workspace || workspace.slug !== slug) return null
  await runtime.activity.touch(workspace.id)
  const [state, connections] = await Promise.all([
    getOverrideState(runtime.db.db, workspace),
    listConnections(runtime.db.db, workspace.id),
  ])
  return {
    state,
    connections: connections.map((c) => ({ id: c.id, name: c.name, kind: c.kind })),
    settings: SimulationSettings.parse(workspace.simulation ?? {}),
    rateLimit: workspace.rateLimit,
  }
}

export async function applyOverride(
  runtime: Runtime,
  slug: string,
  request: ActivateOverrideRequest,
): Promise<OverrideState> {
  const workspace = await workspaceOfSlug(runtime, slug)
  return activateAndPublishOverride(live(runtime), workspace, request, 'ui')
}

/** Back to the settings for each scope (null = workspace wide), one publication each. */
export async function resetOverrideScopes(
  runtime: Runtime,
  slug: string,
  scopes: readonly (string | null)[],
): Promise<OverrideState> {
  const workspace = await workspaceOfSlug(runtime, slug)
  let state: OverrideState | undefined
  for (const scope of scopes) {
    state = await resetAndPublishOverride(live(runtime), workspace, scope ?? undefined)
  }
  return state ?? getOverrideState(runtime.db.db, workspace)
}
