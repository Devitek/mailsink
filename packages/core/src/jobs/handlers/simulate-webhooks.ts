import { type EventBus, publishAll } from '../../events/bus'
import { eventFrame } from '../../events/frames'
import type { SimulationResult } from '../../simulation/simulate-delivery'
import { publishDeliveries } from '../../webhooks/publish'

export interface SimulationWebhookOptions {
  bus?: EventBus
}

/**
 * After a committed simulation run: publishes the automatic opened / clicked events (#34)
 * and the webhook deliveries (#33) the run wrote in its own transaction (D152).
 */
export function publishRunFanOut(
  workspaceId: string,
  result: SimulationResult,
  options: SimulationWebhookOptions = {},
): void {
  if (result.kind !== 'done') return
  if (options.bus?.hasSubscribers(workspaceId) && result.engagement.length > 0) {
    publishAll(
      options.bus,
      workspaceId,
      result.engagement.map((row) => eventFrame(row, result.connectionId)),
    )
  }
  publishDeliveries(options.bus, workspaceId, result.deliveries)
}
