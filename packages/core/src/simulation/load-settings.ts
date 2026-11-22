import { type Executor, findActiveOverrides, findSettingsLayers, type Override } from '@mailsink/db'
import { type ActiveOverride, type EffectiveSettings, resolveSettings } from './settings-resolver'

const active = (row: Override | undefined): ActiveOverride | null =>
  row ? { id: row.id, config: row.config } : null

/** Splits active override rows into the workspace-wide one and one per connection. */
export function overridesByScope(rows: readonly Override[]): {
  workspace: Override | undefined
  connections: Map<string, Override>
} {
  const connections = new Map<string, Override>()
  let workspace: Override | undefined
  for (const row of rows) {
    if (row.connectionId === null) workspace = row
    else connections.set(row.connectionId, row)
  }
  return { workspace, connections }
}

/**
 * Effective settings of a send through `connectionId` (null: no connection, e.g. a
 * connection deleted since) at `now`: stored layers plus the overrides active at `now`.
 * Undefined when the workspace is gone.
 */
export async function loadEffectiveSettings(
  db: Executor,
  workspaceId: string,
  connectionId: string | null,
  now: Date,
): Promise<EffectiveSettings | undefined> {
  const layers = await findSettingsLayers(db, workspaceId, connectionId)
  if (!layers) return undefined
  const scoped = overridesByScope(await findActiveOverrides(db, workspaceId, now))
  return resolveSettings({
    workspace: layers.workspace,
    connection: layers.connection,
    workspaceOverride: active(scoped.workspace),
    connectionOverride: active(connectionId ? scoped.connections.get(connectionId) : undefined),
  })
}
