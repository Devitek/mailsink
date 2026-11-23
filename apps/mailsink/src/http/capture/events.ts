// Manual message events (03-contracts, « Capture », #34): workspace scope auth (D12, D41).
import { MessageId, TriggerEventRequest } from '@mailsink/contracts'
import { triggerAndPublishEvent } from '@mailsink/core'
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
    const live = { db: runtime.db.db, bus: runtime.bus }
    const response = await triggerAndPublishEvent(live, auth.workspace.id, params.id, body, 'api')
    return Response.json(response, { status: 202 })
  },
})
