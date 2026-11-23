import type { EventOrigin, TriggerEventRequest, TriggerEventResponse } from '@mailsink/contracts'
import { publishAll } from '../events/bus'
import { eventFrame, statusFrame, toEventView } from '../events/frames'
import type { LiveDeps } from '../events/live'
import { publishDeliveries } from '../webhooks/publish'
import { triggerMessageEvent } from './manual'

/**
 * Manual event shared by `POST /capture/messages/:id/events` and the MCP tool
 * `trigger_email_event`: records it, then publishes the events, the new aggregate and the
 * webhook deliveries after commit (D6), so open streams see the action whatever its origin.
 */
export async function triggerAndPublishEvent(
  { db, bus }: LiveDeps,
  workspaceId: string,
  messageId: string,
  request: TriggerEventRequest,
  origin: EventOrigin,
): Promise<TriggerEventResponse> {
  const result = await triggerMessageEvent(db, workspaceId, messageId, request, origin)
  const frames = result.events.map((row) => eventFrame(row, result.connectionId))
  if (result.messageStatus) {
    frames.push(statusFrame(messageId, result.messageStatus, result.connectionId))
  }
  publishAll(bus, workspaceId, frames)
  publishDeliveries(bus, workspaceId, result.deliveries)
  return {
    events: result.events.map(toEventView),
    webhookDeliveries: result.deliveries.map((d) => ({
      id: d.delivery.id,
      endpointId: d.delivery.endpointId,
    })),
  }
}
