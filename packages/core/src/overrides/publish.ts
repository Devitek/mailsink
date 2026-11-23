import type { ActivateOverrideRequest, EventOrigin, OverrideState } from '@mailsink/contracts'
import { type Database, findWorkspaceByRef, type Override, type Workspace } from '@mailsink/db'
import type { EventBus, StreamFrame } from '../events/bus'
import type { LiveDeps } from '../events/live'
import { activateOverride, getOverrideState, resetOverride } from './service'

type WorkspaceSettings = Pick<Workspace, 'id' | 'simulation' | 'rateLimit'>

/**
 * `override.changed`: derived (no SSE id, never replayed, D80) and never filtered out by
 * `connectionId` (D84); `connectionId` is the scope that changed, null for the workspace.
 */
export function overrideChangedFrame(
  state: OverrideState,
  connectionId: string | null,
): StreamFrame {
  return { id: null, connectionId, event: { type: 'override.changed', state } }
}

/**
 * Hook of the override expiry scheduler (D96): one `override.changed` with the new state
 * per workspace that lost an override in the pass. Workspaces nobody listens to cost no
 * query; a workspace deleted meanwhile publishes nothing.
 */
export async function publishExpiredOverrides(
  db: Database,
  bus: EventBus,
  closed: readonly Override[],
  now: Date = new Date(),
): Promise<void> {
  const scopes = new Map<string, string | null>()
  for (const o of closed) {
    const known = scopes.get(o.workspaceId)
    // Two scopes expiring together: the workspace scope stands for both.
    scopes.set(o.workspaceId, known === undefined ? o.connectionId : null)
  }
  for (const [workspaceId, connectionId] of scopes) {
    if (!bus.hasSubscribers(workspaceId)) continue
    const workspace = await findWorkspaceByRef(db, workspaceId)
    if (!workspace) continue
    const state = await getOverrideState(db, workspace, now)
    bus.publish(workspaceId, overrideChangedFrame(state, connectionId))
  }
}

/**
 * Activation shared by `POST /capture/override` and the MCP tool `set_override_config`:
 * every change publishes the new state (D96), recorded with its origin (`api`, `mcp`).
 */
export async function activateAndPublishOverride(
  { db, bus }: LiveDeps,
  workspace: WorkspaceSettings,
  request: ActivateOverrideRequest,
  via: EventOrigin,
): Promise<OverrideState> {
  const state = await activateOverride(db, workspace, request, via)
  bus.publish(workspace.id, overrideChangedFrame(state, request.connectionId ?? null))
  return state
}

/** Reset shared by `POST /capture/override/reset` and `reset_override_config`, idempotent
 * and published even when nothing was open (D96). */
export async function resetAndPublishOverride(
  { db, bus }: LiveDeps,
  workspace: WorkspaceSettings,
  connectionId: string | undefined,
): Promise<OverrideState> {
  const state = await resetOverride(db, workspace, connectionId)
  bus.publish(workspace.id, overrideChangedFrame(state, connectionId ?? null))
  return state
}
