import { z } from 'zod'
import { AddressOut } from './address'
import { IsoDateTime, issue, Page, PageLimit, QueryBool, Tag } from './common'
import { AttachmentId, ConnectionId, EventId, MessageId } from './ids'
import {
  DeliveryStatus,
  EventOrigin,
  EventType,
  MessageSource,
  RecipientKind,
  SimulatedStatus,
} from './status'
import { WebhookDeliveryView } from './webhook-delivery'

export const WAIT_TIMEOUT_MAX_MS = 30_000

export const ListMessagesQuery = z
  .object({
    to: z.string().optional(), // substring, case-insensitive
    from: z.string().optional(),
    subject: z.string().optional(),
    tag: z.string().optional(), // "name" or "name:value"
    // "delivered", "delivered,failed" or repeated ?status= -> array
    status: z
      .preprocess((v) => (typeof v === 'string' ? v.split(',') : v), z.array(DeliveryStatus))
      .optional(),
    connectionId: ConnectionId.optional(),
    since: IsoDateTime.optional(),
    until: IsoDateTime.optional(),
    q: z.string().optional(), // full text (subject, body)
    limit: PageLimit,
    cursor: z.string().optional(),
    wait: QueryBool.default(false),
    timeout: z.coerce.number().int().min(0).max(WAIT_TIMEOUT_MAX_MS).default(5_000),
  })
  .refine(
    (q) => !q.since || !q.until || Date.parse(q.since) <= Date.parse(q.until),
    issue('since_after_until', 'since must be before until', ['until']),
  )
// wait=true: returns as soon as >= 1 message matches (created after the request when
// `since` is absent), else 408 wait_timeout after `timeout` ms.

export const MessageSummary = z.object({
  id: MessageId,
  connectionId: ConnectionId.nullable(),
  source: MessageSource,
  from: AddressOut,
  to: z.array(AddressOut),
  subject: z.string(),
  status: DeliveryStatus,
  tags: z.array(Tag),
  hasAttachments: z.boolean(),
  createdAt: IsoDateTime,
})

export const ListMessagesResponse = Page(MessageSummary)

export const MessageEventView = z.object({
  id: EventId,
  type: EventType,
  origin: EventOrigin,
  recipient: z.string().nullable(),
  data: z.object({
    url: z.string().optional(),
    userAgent: z.string().optional(),
    reason: z.string().optional(),
    smtpCode: z.number().int().optional(),
  }),
  occurredAt: IsoDateTime,
})

export const AttachmentView = z.object({
  id: AttachmentId,
  filename: z.string().nullable(),
  contentType: z.string(),
  contentId: z.string().nullable(),
  sizeBytes: z.number().int(),
  inline: z.boolean(),
  downloadUrl: z.string(),
})

export const RecipientView = z.object({
  email: z.string(),
  name: z.string().nullable(),
  kind: RecipientKind,
  status: DeliveryStatus,
  reason: z.string().nullable(),
})

export const MessageDetail = MessageSummary.extend({
  cc: z.array(AddressOut),
  bcc: z.array(AddressOut),
  replyTo: z.array(AddressOut),
  html: z.string().nullable(),
  text: z.string().nullable(),
  headers: z.record(z.string(), z.string()),
  metadata: z.record(z.string(), z.unknown()),
  links: z.array(z.object({ url: z.string(), text: z.string().optional() })),
  attachments: z.array(AttachmentView),
  recipients: z.array(RecipientView),
  events: z.array(MessageEventView),
  rawUrl: z.string(),
  simulation: z.record(z.string(), z.unknown()).nullable(),
  webhookDeliveries: z.array(WebhookDeliveryView), // newest first (#33)
})

export const TriggerEventRequest = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('opened'),
    recipient: z.email().optional(),
    userAgent: z.string().optional(),
  }),
  z.object({
    type: z.literal('clicked'),
    url: z.url(),
    recipient: z.email().optional(),
    userAgent: z.string().optional(),
  }),
  // Forced simulated status (B1-1): recipient status, message aggregate, suppression list
  // (hard_bounce, complained) and webhooks, like a drawn status. `invalid` is never listed.
  z.object({
    type: z.literal('status'),
    status: SimulatedStatus,
    recipient: z.email().optional(),
    reason: z.string().max(500).optional(),
  }),
])

/** 202: the events written (one per recipient) and the webhook deliveries they created. */
export const TriggerEventResponse = z.object({
  events: z.array(MessageEventView),
  webhookDeliveries: z.array(z.object({ id: z.string(), endpointId: z.string() })),
})

export const PurgeQuery = z.object({
  connectionId: ConnectionId.optional(),
  before: IsoDateTime.optional(),
  includeLogs: QueryBool.default(true),
})

export const PurgeResponse = z.object({ count: z.number().int().min(0) })

export type ListMessagesQuery = z.output<typeof ListMessagesQuery>
export type MessageSummary = z.output<typeof MessageSummary>
export type MessageEventView = z.output<typeof MessageEventView>
export type MessageDetail = z.output<typeof MessageDetail>
export type TriggerEventRequest = z.output<typeof TriggerEventRequest>
export type TriggerEventResponse = z.output<typeof TriggerEventResponse>
export type PurgeQuery = z.output<typeof PurgeQuery>
export type PurgeResponse = z.output<typeof PurgeResponse>
