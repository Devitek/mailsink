import { type Executor, listWorkspaceEventsAfter } from '@mailsink/db'
import type { StreamFrame } from './bus'
import { framesOfRows } from './frames'

/** Events replayed after a `Last-Event-ID` at most (03-contracts, « Stream »). */
export const REPLAY_LIMIT = 500

/**
 * Frames stored after `lastEventId`, oldest first, bounded to `limit` rows. Derived frames
 * (aggregated status, purge) have no row and are not replayed: a client that reconnects
 * gets every stored event it missed, and reloads aggregates through the Capture API.
 */
export async function replayFrames(
  db: Executor,
  workspaceId: string,
  lastEventId: string,
  limit = REPLAY_LIMIT,
): Promise<StreamFrame[]> {
  const rows = await listWorkspaceEventsAfter(db, workspaceId, lastEventId, limit)
  return framesOfRows(db, workspaceId, rows)
}
