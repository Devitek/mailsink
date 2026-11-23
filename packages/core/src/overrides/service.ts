import type { ActivateOverrideRequest, EventOrigin, OverrideState } from '@mailsink/contracts'
import {
  closeOverride,
  type Database,
  type Executor,
  findActiveOverrides,
  insertOverride,
  listConnections,
  newId,
  type Workspace,
} from '@mailsink/db'
import { DomainError } from '../errors'
import { overridesByScope } from '../simulation/load-settings'
import { resolveSettings, toSimulationSettings } from '../simulation/settings-resolver'
import { toOverrideView } from './views'

type WorkspaceSettings = Pick<Workspace, 'id' | 'simulation' | 'rateLimit'>

/**
 * `OverrideState`: the active overrides (expired ones are ignored even before the scheduler
 * closes them) and the resolved simulation settings of every connection of the workspace.
 */
export async function getOverrideState(
  db: Executor,
  workspace: WorkspaceSettings,
  now: Date = new Date(),
): Promise<OverrideState> {
  const scoped = overridesByScope(await findActiveOverrides(db, workspace.id, now))
  const connections = await listConnections(db, workspace.id)
  const effective: OverrideState['effective'] = {}
  for (const c of connections) {
    const own = scoped.connections.get(c.id)
    effective[c.id] = toSimulationSettings(
      resolveSettings({
        workspace: { simulation: workspace.simulation, rateLimit: workspace.rateLimit },
        connection: { simulation: c.simulation, rateLimit: c.rateLimit },
        workspaceOverride: scoped.workspace ?? null,
        connectionOverride: own ?? null,
      }),
    )
  }
  return {
    workspace: scoped.workspace ? toOverrideView(scoped.workspace) : null,
    connections: [...scoped.connections.values()].map(toOverrideView),
    effective,
  }
}

async function assertConnection(db: Executor, workspaceId: string, connectionId?: string) {
  if (connectionId === undefined) return
  const connections = await listConnections(db, workspaceId)
  if (!connections.some((c) => c.id === connectionId)) {
    throw new DomainError('not_found', 'Connection not found')
  }
}

const isUniqueViolation = (error: unknown): boolean => {
  let current: unknown = error
  while (current && typeof current === 'object') {
    if ('code' in current && current.code === '23505') return true
    current = 'cause' in current ? current.cause : undefined
  }
  return false
}

/**
 * Activates an override on the workspace or one connection: the open override of that
 * scope is closed (`reset_at`, history kept) and the new one inserted, in one transaction.
 * `request.config` is the parsed contract output (chaos codes defaulted, D44).
 */
export async function activateOverride(
  db: Database,
  workspace: WorkspaceSettings,
  request: ActivateOverrideRequest,
  via: EventOrigin,
  now: Date = new Date(),
): Promise<OverrideState> {
  try {
    await db.transaction(async (tx) => {
      await assertConnection(tx, workspace.id, request.connectionId)
      const connectionId = request.connectionId ?? null
      await closeOverride(tx, workspace.id, connectionId, now)
      await insertOverride(tx, {
        id: newId('ovr', now.getTime()),
        workspaceId: workspace.id,
        connectionId,
        config: request.config,
        activatedVia: via,
        expiresAt: request.ttl ? new Date(now.getTime() + request.ttl * 1000) : null,
        createdAt: now,
      })
    })
  } catch (error) {
    if (!isUniqueViolation(error)) throw error
    throw new DomainError(
      'conflict',
      'Another override of this scope was activated at the same time',
    )
  }
  return getOverrideState(db, workspace, now)
}

/** Back to the settings: closes the open override of the scope, if any (idempotent). */
export async function resetOverride(
  db: Database,
  workspace: WorkspaceSettings,
  connectionId: string | undefined,
  now: Date = new Date(),
): Promise<OverrideState> {
  await assertConnection(db, workspace.id, connectionId)
  await closeOverride(db, workspace.id, connectionId ?? null, now)
  return getOverrideState(db, workspace, now)
}
