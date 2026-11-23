// Webhook delivery log and replay (03-contracts, « Webhooks », #33): workspace scope auth.
import { ListWebhookDeliveriesQuery, ReplayRequest, WebhookDeliveryId } from '@mailsink/contracts'
import {
  getWebhookDeliveryDetail,
  listWebhookDeliveryViews,
  replayWebhookDelivery,
  toDeliveryViews,
} from '@mailsink/core'
import { z } from 'zod'
import { defineApi } from '../handler'

const DeliveryParams = z.object({ id: WebhookDeliveryId })

/** GET /capture/webhooks/deliveries: newest first, filters, keyset cursor. */
export const listDeliveriesApi = defineApi({
  auth: 'workspace',
  query: ListWebhookDeliveriesQuery,
  handler: ({ runtime, auth, query }) =>
    listWebhookDeliveryViews(runtime.db.db, auth.workspace.id, query),
})

/** GET /capture/webhooks/deliveries/:id: body and every attempt with its exact headers. */
export const getDeliveryApi = defineApi({
  auth: 'workspace',
  params: DeliveryParams,
  handler: ({ runtime, auth, params }) =>
    getWebhookDeliveryDetail(runtime.db.db, auth.workspace.id, params.id),
})

/** POST /capture/webhooks/deliveries/:id/replay: 202 with the new (pending) delivery. */
export const replayDeliveryApi = defineApi({
  auth: 'workspace',
  params: DeliveryParams,
  body: ReplayRequest.optional(),
  handler: async ({ runtime, auth, params, body }) => {
    const replay = await replayWebhookDelivery(
      runtime.db.db,
      auth.workspace.id,
      params.id,
      body ?? ReplayRequest.parse({}),
      { bus: runtime.bus },
    )
    const [view] = await toDeliveryViews(runtime.db.db, [replay])
    return Response.json(view, { status: 202 })
  },
})
