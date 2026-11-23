import { count, inArray } from 'drizzle-orm'
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
