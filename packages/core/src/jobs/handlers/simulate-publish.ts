import { type EventBus, publishAll, type StreamFrame } from '../../events/bus'
import { eventFrame, statusFrame } from '../../events/frames'
import type { SimulationResult } from '../../simulation/simulate-delivery'

export interface PublishSimulationOptions {
  /** Receives the events the simulation wrote and the aggregated status (D6). */
  bus?: EventBus
}

/**
 * Publishes one `message.event` per row written by the run (`sent`, then the final status
 * of each recipient), then the aggregated `message.status`. The rows come with the result
 * (D95): nothing is read back, and every subscriber present at publication gets them all.
 */
export function publishSimulation(
  workspaceId: string,
  messageId: string,
  result: SimulationResult,
  { bus }: PublishSimulationOptions,
): void {
  if (!bus?.hasSubscribers(workspaceId) || result.kind !== 'done') return
  if (result.events.length === 0) return
  const frames: StreamFrame[] = result.events.map((row) => eventFrame(row, result.connectionId))
  if (result.messageStatus) {
    frames.push(statusFrame(messageId, result.messageStatus, result.connectionId))
  }
  publishAll(bus, workspaceId, frames)
}
