import type { TriggerEventRequest, TriggerEventResponse } from '@mailsink/contracts'
import {
  eventFrame,
  publishAll,
  publishDeliveries,
  statusFrame,
  toEventView,
  triggerMessageEvent,
} from '@mailsink/core'
import type { Runtime } from '../runtime/container'
import { workspaceOfSlug } from './messages.server'

/**
 * « Simulate » actions of the viewer (#40, B1-1): the service of
 * `POST /capture/messages/:id/events` with origin `ui`, frames and deliveries published the
 * same way, so the inbox and every other listener see the change live.
 */
export async function triggerUiEvent(
  runtime: Runtime,
  slug: string,
  messageId: string,
  request: TriggerEventRequest,
): Promise<TriggerEventResponse> {
  const { id: workspaceId } = await workspaceOfSlug(runtime, slug)
  const result = await triggerMessageEvent(runtime.db.db, workspaceId, messageId, request, 'ui')
  const frames = result.events.map((row) => eventFrame(row, result.connectionId))
  if (result.messageStatus) {
    frames.push(statusFrame(messageId, result.messageStatus, result.connectionId))
  }
  publishAll(runtime.bus, workspaceId, frames)
  publishDeliveries(runtime.bus, workspaceId, result.deliveries)
  return {
    events: result.events.map(toEventView),
    webhookDeliveries: result.deliveries.map((d) => ({
      id: d.delivery.id,
      endpointId: d.delivery.endpointId,
    })),
  }
}
