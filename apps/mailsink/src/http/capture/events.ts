// Manual message events (03-contracts, « Capture », #34): workspace scope auth (D12, D41).
import { MessageId, TriggerEventRequest, type TriggerEventResponse } from '@mailsink/contracts'
import {
  eventFrame,
  publishAll,
  publishDeliveries,
  statusFrame,
  toEventView,
  triggerMessageEvent,
} from '@mailsink/core'
import { z } from 'zod'
import { defineApi } from '../handler'

const MessageParams = z.object({ id: MessageId })

/**
 * POST /capture/messages/:id/events: opened, clicked or a forced simulated status, one
 * event per recipient. Publishes the events, the new aggregate and the deliveries (D6).
 */
export const postMessageEventApi = defineApi({
  auth: 'workspace',
  params: MessageParams,
  body: TriggerEventRequest,
  handler: async ({ runtime, auth, params, body }) => {
    const workspaceId = auth.workspace.id
    const result = await triggerMessageEvent(runtime.db.db, workspaceId, params.id, body)
    const frames = result.events.map((row) => eventFrame(row, result.connectionId))
    if (result.messageStatus) {
      frames.push(statusFrame(params.id, result.messageStatus, result.connectionId))
    }
    publishAll(runtime.bus, workspaceId, frames)
    publishDeliveries(runtime.bus, workspaceId, result.deliveries)
    const response: TriggerEventResponse = {
      events: result.events.map(toEventView),
      webhookDeliveries: result.deliveries.map((d) => ({
        id: d.delivery.id,
        endpointId: d.delivery.endpointId,
      })),
    }
    return Response.json(response, { status: 202 })
  },
})
