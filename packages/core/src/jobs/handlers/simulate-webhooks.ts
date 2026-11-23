import type { Database } from '@mailsink/db'
import { type EventBus, publishAll } from '../../events/bus'
import { eventFrame } from '../../events/frames'
import { type EngagementOptions, recordEngagement } from '../../events-api/engagement'
import type { SimulationResult } from '../../simulation/simulate-delivery'
import { fanOutEvents } from '../../webhooks/fanout'
import { publishDeliveries } from '../../webhooks/publish'

export interface SimulationWebhookOptions {
  bus?: EventBus
  engagement?: EngagementOptions
}

/**
 * After a committed simulation run: automatic opened / clicked events (#34), then the
 * webhook fan-out of every event the run wrote plus those (#33), in one transaction.
 * A crash before it commits loses these deliveries (the run itself is not replayed).
 */
export async function fanOutSimulation(
  db: Database,
  workspaceId: string,
  result: SimulationResult,
  options: SimulationWebhookOptions = {},
): Promise<void> {
  if (result.kind !== 'done' || result.events.length === 0) return
  const { engagement, deliveries } = await db.transaction(async (tx) => {
    const engagement = await recordEngagement(
      tx,
      workspaceId,
      result.connectionId,
      result.events,
      options.engagement,
    )
    const deliveries = await fanOutEvents(tx, workspaceId, [...result.events, ...engagement])
    return { engagement, deliveries }
  })
  if (options.bus?.hasSubscribers(workspaceId)) {
    publishAll(
      options.bus,
      workspaceId,
      engagement.map((row) => eventFrame(row, result.connectionId)),
    )
  }
  publishDeliveries(options.bus, workspaceId, deliveries)
}
