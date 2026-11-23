import type { Executor, MessageEventRow } from '@mailsink/db'
import { type EngagementOptions, recordEngagement } from '../events-api/engagement'
import { type FannedOut, fanOutEvents } from '../webhooks/fanout'

export interface RunFanOut {
  /** Automatic `opened` / `clicked` rows written after the run's `delivered` events (#34). */
  engagement: MessageEventRow[]
  /** Webhook deliveries of the run's events and of the engagement rows (#33). */
  deliveries: FannedOut[]
}

/**
 * Engagement and webhook fan-out of one simulation run, in the run's own transaction
 * (D152): the run, its engagement events, its deliveries and their `deliver_webhook` jobs
 * commit together, so a crash can no longer lose the deliveries of a committed run (D141).
 */
export async function fanOutRun(
  tx: Executor,
  workspaceId: string,
  connectionId: string | null,
  events: readonly MessageEventRow[],
  options: EngagementOptions = {},
): Promise<RunFanOut> {
  if (events.length === 0) return { engagement: [], deliveries: [] }
  const engagement = await recordEngagement(tx, workspaceId, connectionId, events, options)
  const deliveries = await fanOutEvents(tx, workspaceId, [...events, ...engagement])
  return { engagement, deliveries }
}
