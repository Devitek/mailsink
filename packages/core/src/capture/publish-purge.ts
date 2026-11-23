import type { PurgeQuery, PurgeResponse } from '@mailsink/contracts'
import type { LiveDeps } from '../events/live'
import { purgeCapturedMessages } from './service'

/**
 * Purge shared by `DELETE /capture/messages` and the MCP tool `purge_emails`: deletes, then
 * publishes `messages.purged` (derived frame, scope of the purge) so open lists refresh.
 */
export async function purgeAndPublish(
  { db, bus }: LiveDeps,
  workspaceId: string,
  query: PurgeQuery,
): Promise<PurgeResponse> {
  const purged = await purgeCapturedMessages(db, workspaceId, query)
  bus.publish(workspaceId, {
    id: null,
    connectionId: query.connectionId ?? null,
    event: { type: 'messages.purged', count: purged.count },
  })
  return purged
}
