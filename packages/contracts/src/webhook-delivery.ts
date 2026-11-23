import { z } from 'zod'
import { IsoDateTime, Page, PageLimit } from './common'
import { EventId, MessageId, WebhookDeliveryId, WebhookEndpointId } from './ids'
import { CanonicalEvent } from './status'
import { PayloadFormat } from './webhook'

// Delivery log and replay (03-contracts, « Delivery lifecycle, retries and replay », D24).

export const WebhookDeliveryStatus = z.enum(['pending', 'retrying', 'succeeded', 'failed'])
export const ReplayMode = z.enum(['exact', 'resign'])

export const WebhookDeliveryView = z.object({
  id: WebhookDeliveryId,
  endpointId: WebhookEndpointId,
  messageId: MessageId.nullable(),
  eventId: EventId.nullable(), // null for a test send
  payloadFormat: PayloadFormat,
  canonicalEvent: CanonicalEvent,
  dialectEvent: z.string(),
  recipient: z.string().nullable(),
  status: WebhookDeliveryStatus,
  attemptCount: z.number().int(),
  nextAttemptAt: IsoDateTime.nullable(),
  lastStatusCode: z.number().int().nullable(),
  replayOf: WebhookDeliveryId.nullable(),
  replayMode: ReplayMode.nullable(),
  createdAt: IsoDateTime,
})

export const WebhookAttemptView = z.object({
  id: z.string(),
  attemptNo: z.number().int(),
  requestHeaders: z.record(z.string(), z.string()), // exactly as sent
  signedAt: z.number().int().nullable(),
  responseStatus: z.number().int().nullable(),
  responseBody: z.string().nullable(), // truncated to 4 KB
  durationMs: z.number().int(),
  error: z.string().nullable(),
  createdAt: IsoDateTime,
})

export const WebhookDeliveryDetail = WebhookDeliveryView.extend({
  body: z.string(), // exact bytes sent by every attempt
  contentType: z.string(),
  attempts: z.array(WebhookAttemptView),
})

export const ListWebhookDeliveriesQuery = z.object({
  endpointId: WebhookEndpointId.optional(),
  payloadFormat: PayloadFormat.optional(),
  messageId: MessageId.optional(),
  status: WebhookDeliveryStatus.optional(),
  limit: PageLimit,
  cursor: WebhookDeliveryId.optional(), // id of the last row of the previous page
})
export const ListWebhookDeliveriesResponse = Page(WebhookDeliveryView)

export const ReplayRequest = z.object({
  mode: ReplayMode.default('exact'),
  attemptId: z.string().optional(), // exact: headers of this attempt (default: last)
})

export type WebhookDeliveryStatus = z.output<typeof WebhookDeliveryStatus>
export type ReplayMode = z.output<typeof ReplayMode>
export type WebhookDeliveryView = z.output<typeof WebhookDeliveryView>
export type WebhookAttemptView = z.output<typeof WebhookAttemptView>
export type WebhookDeliveryDetail = z.output<typeof WebhookDeliveryDetail>
export type ListWebhookDeliveriesQuery = z.output<typeof ListWebhookDeliveriesQuery>
export type ListWebhookDeliveriesResponse = z.output<typeof ListWebhookDeliveriesResponse>
export type ReplayRequest = z.output<typeof ReplayRequest>
