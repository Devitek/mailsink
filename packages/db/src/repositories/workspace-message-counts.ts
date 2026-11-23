import { and, count, eq, inArray, isNotNull } from 'drizzle-orm'
import type { Executor } from '../client'
import { messages } from '../schema/messages'

/**
 * Captured messages per workspace, for the workspace picker (one grouped read on the
 * `messages_ws_*` indexes). Workspaces without messages are absent from the map.
 */
export async function countMessagesByWorkspace(
  db: Executor,
  workspaceIds: readonly string[],
): Promise<Map<string, number>> {
  if (workspaceIds.length === 0) return new Map()
  const rows = await db
    .select({ workspaceId: messages.workspaceId, total: count() })
    .from(messages)
    .where(inArray(messages.workspaceId, [...workspaceIds]))
    .groupBy(messages.workspaceId)
  return new Map(rows.map((r) => [r.workspaceId, Number(r.total)]))
}

/**
 * Captured messages per connection of a workspace (connections screen, « Resend · 1 284
 * messages »). Connections without messages are absent from the map.
 */
export async function countMessagesByConnection(
  db: Executor,
  workspaceId: string,
): Promise<Map<string, number>> {
  const rows = await db
    .select({ connectionId: messages.connectionId, total: count() })
    .from(messages)
    .where(and(eq(messages.workspaceId, workspaceId), isNotNull(messages.connectionId)))
    .groupBy(messages.connectionId)
  return new Map(rows.flatMap((r) => (r.connectionId ? [[r.connectionId, Number(r.total)]] : [])))
}
